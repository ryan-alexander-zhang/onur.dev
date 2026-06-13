import { defineEndpoint, node, p, t, type InferOutputRow, type InferParams } from '@tinybirdco/sdk'

import { dashboardToken } from './tokens'

const sharedParams = {
  tenant_id: p.string().optional().describe('Optional tenant filter'),
  domain: p.string().optional().describe('Optional domain filter'),
  date_from: p.date().optional().describe('Inclusive start date'),
  date_to: p.date().optional().describe('Inclusive end date')
}

const resolvedDomainSql = `
  JSONExtractString(payload, 'href') AS href,
  JSONExtractString(payload, 'domain') AS domain_from_payload,
  if(href != '', domainWithoutWWW(href), '') AS derived_domain,
  multiIf(
    analytics_events.domain != '',
    analytics_events.domain,
    derived_domain != '',
    derived_domain,
    domain_from_payload
  ) AS resolved_domain
`

const sharedFiltersSql = `
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
`

export const currentVisitors = defineEndpoint('current_visitors', {
  description: 'Unique sessions with a page hit in the last 5 minutes.',
  tokens: [{ token: dashboardToken, scope: 'READ' }],
  params: {
    tenant_id: sharedParams.tenant_id,
    domain: sharedParams.domain
  },
  nodes: [
    node({
      name: 'endpoint',
      sql: `
        WITH
          ${resolvedDomainSql}
        SELECT uniq(session_id) AS visits
        FROM analytics_events
        WHERE action = 'page_hit'
          AND timestamp >= now() - interval 5 minute
          {% if defined(tenant_id) %}
          AND tenant_id = {{ String(tenant_id) }}
          {% end %}
          {% if defined(domain) %}
          AND resolved_domain = {{ String(domain) }}
          {% end %}
      `
    })
  ],
  output: {
    visits: t.uint64()
  }
})

export type CurrentVisitorsParams = InferParams<typeof currentVisitors>
export type CurrentVisitorsOutput = InferOutputRow<typeof currentVisitors>

export const topPages = defineEndpoint('top_pages', {
  description: 'Most visited paths for page_hit events.',
  tokens: [{ token: dashboardToken, scope: 'READ' }],
  params: {
    ...sharedParams,
    limit: p.int32().optional(20).describe('Maximum rows to return')
  },
  nodes: [
    node({
      name: 'endpoint',
      sql: `
        WITH
          ${resolvedDomainSql},
          JSONExtractString(payload, 'pathname') AS pathname
        SELECT
          pathname,
          count() AS views,
          uniq(session_id) AS visitors
        FROM analytics_events
        WHERE action = 'page_hit'
          AND pathname != ''
          ${sharedFiltersSql}
        GROUP BY pathname
        ORDER BY views DESC, pathname ASC
        LIMIT {{ Int32(limit, 20) }}
      `
    })
  ],
  output: {
    pathname: t.string(),
    views: t.uint64(),
    visitors: t.uint64()
  }
})

export type TopPagesParams = InferParams<typeof topPages>
export type TopPagesOutput = InferOutputRow<typeof topPages>

export const pageViewsTimeseries = defineEndpoint('page_views_timeseries', {
  description: 'Daily page views and visitors for page_hit events.',
  tokens: [{ token: dashboardToken, scope: 'READ' }],
  params: sharedParams,
  nodes: [
    node({
      name: 'endpoint',
      sql: `
        WITH
          ${resolvedDomainSql}
        SELECT
          toDate(timestamp) AS date,
          count() AS views,
          uniq(session_id) AS visitors
        FROM analytics_events
        WHERE action = 'page_hit'
          ${sharedFiltersSql}
        GROUP BY date
        ORDER BY date ASC
      `
    })
  ],
  output: {
    date: t.date(),
    views: t.uint64(),
    visitors: t.uint64()
  }
})

export type PageViewsTimeseriesParams = InferParams<typeof pageViewsTimeseries>
export type PageViewsTimeseriesOutput = InferOutputRow<typeof pageViewsTimeseries>

export const topSources = defineEndpoint('top_sources', {
  description: 'Top referrer sources for page_hit events.',
  tokens: [{ token: dashboardToken, scope: 'READ' }],
  params: {
    ...sharedParams,
    limit: p.int32().optional(20).describe('Maximum rows to return')
  },
  nodes: [
    node({
      name: 'endpoint',
      sql: `
        WITH
          ${resolvedDomainSql},
          JSONExtractString(payload, 'referrer') AS referrer,
          if(referrer = '', 'direct', domainWithoutWWW(referrer)) AS source
        SELECT
          source,
          count() AS views,
          uniq(session_id) AS visitors
        FROM analytics_events
        WHERE action = 'page_hit'
          ${sharedFiltersSql}
        GROUP BY source
        ORDER BY views DESC, source ASC
        LIMIT {{ Int32(limit, 20) }}
      `
    })
  ],
  output: {
    source: t.string(),
    views: t.uint64(),
    visitors: t.uint64()
  }
})

export type TopSourcesParams = InferParams<typeof topSources>
export type TopSourcesOutput = InferOutputRow<typeof topSources>

export const webVitalsSummary = defineEndpoint('web_vitals_summary', {
  description: 'Summary statistics for web_vital events by metric name.',
  tokens: [{ token: dashboardToken, scope: 'READ' }],
  params: sharedParams,
  nodes: [
    node({
      name: 'endpoint',
      sql: `
        WITH
          ${resolvedDomainSql},
          JSONExtractString(payload, 'name') AS metric_name,
          JSONExtractFloat(payload, 'value') AS metric_value
        SELECT
          metric_name,
          round(avg(metric_value), 2) AS avg_value,
          round(quantile(0.75)(metric_value), 2) AS p75_value,
          count() AS samples
        FROM analytics_events
        WHERE action = 'web_vital'
          ${sharedFiltersSql}
        GROUP BY metric_name
        ORDER BY metric_name ASC
      `
    })
  ],
  output: {
    metric_name: t.string(),
    avg_value: t.float64(),
    p75_value: t.float64(),
    samples: t.uint64()
  }
})

export type WebVitalsSummaryParams = InferParams<typeof webVitalsSummary>
export type WebVitalsSummaryOutput = InferOutputRow<typeof webVitalsSummary>
