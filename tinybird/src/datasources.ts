import { defineDatasource, engine, t, type InferRow } from '@tinybirdco/sdk'

import { trackerToken } from './tokens'

export const analyticsEvents = defineDatasource('analytics_events', {
  description: 'Raw analytics events collected by flock.js.',
  tokens: [{ token: trackerToken, scope: 'APPEND' }],
  schema: {
    timestamp: t.dateTime(),
    action: t.string().lowCardinality(),
    version: t.string().lowCardinality(),
    session_id: t.string().nullable(),
    tenant_id: t.string().default(''),
    domain: t.string().default(''),
    payload: t.string()
  },
  engine: engine.mergeTree({
    partitionKey: 'toYYYYMM(timestamp)',
    sortingKey: ['tenant_id', 'domain', 'timestamp']
  })
})

export type AnalyticsEventsRow = InferRow<typeof analyticsEvents>
