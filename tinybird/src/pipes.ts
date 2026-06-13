import { defineEndpoint, node, p, t, type InferOutputRow, type InferParams } from '@tinybirdco/sdk'

import { dashboardToken } from './tokens'

export const analyticsHits = defineEndpoint('analytics_hits', {
  description: 'Parsed page_hit events from the raw analytics_events datasource.',
  tokens: [{ token: dashboardToken, scope: 'READ' }],
  params: {
    tenant_id: p.string().optional().describe('Optional tenant filter'),
    domain: p.string().optional().describe('Optional domain filter'),
    date_from: p.date().optional().describe('Inclusive start date'),
    date_to: p.date().optional().describe('Inclusive end date'),
    limit: p.int32().optional(100).describe('Maximum number of rows to return'),
    offset: p.int32().optional(0).describe('Offset for pagination')
  },
  nodes: [
    node({
      name: 'endpoint',
      sql: `
        WITH
          JSONExtractString(payload, 'href') AS href,
          JSONExtractString(payload, 'pathname') AS pathname,
          JSONExtractString(payload, 'referrer') AS referrer,
          JSONExtractString(payload, 'location') AS location,
          JSONExtractString(payload, 'locale') AS locale,
          JSONExtractString(payload, 'user-agent') AS raw_user_agent,
          JSONExtractString(payload, 'domain') AS domain_from_payload,
          if(href != '', domainWithoutWWW(href), '') AS derived_domain,
          multiIf(
            analytics_events.domain != '',
            analytics_events.domain,
            derived_domain != '',
            derived_domain,
            domain_from_payload
          ) AS resolved_domain
        SELECT
          timestamp,
          coalesce(session_id, '') AS session_id,
          tenant_id,
          resolved_domain AS domain,
          pathname,
          href,
          referrer,
          location,
          locale,
          lower(raw_user_agent) AS user_agent
        FROM analytics_events
        WHERE action = 'page_hit'
          {% if defined(tenant_id) %}
          AND tenant_id = {{ String(tenant_id) }}
          {% end %}
          {% if defined(domain) %}
          AND resolved_domain = {{ String(domain) }}
          {% end %}
          {% if defined(date_from) %}
          AND toDate(timestamp) >= {{ Date(date_from) }}
          {% end %}
          {% if defined(date_to) %}
          AND toDate(timestamp) <= {{ Date(date_to) }}
          {% end %}
        ORDER BY timestamp DESC
        LIMIT {{ Int32(limit, 100) }}
        OFFSET {{ Int32(offset, 0) }}
      `
    })
  ],
  output: {
    timestamp: t.dateTime(),
    session_id: t.string(),
    tenant_id: t.string(),
    domain: t.string(),
    pathname: t.string(),
    href: t.string(),
    referrer: t.string(),
    location: t.string(),
    locale: t.string(),
    user_agent: t.string()
  }
})

export type AnalyticsHitsParams = InferParams<typeof analyticsHits>
export type AnalyticsHitsOutput = InferOutputRow<typeof analyticsHits>
