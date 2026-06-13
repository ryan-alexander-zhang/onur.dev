import { Tinybird } from '@tinybirdco/sdk'

import { analyticsEvents } from './datasources'
import { currentVisitors, pageViewsTimeseries, topPages, topSources, webVitalsSummary } from './endpoints'
import { analyticsHits } from './pipes'

export const tinybird = new Tinybird({
  datasources: {
    analyticsEvents
  },
  pipes: {
    analyticsHits,
    currentVisitors,
    topPages,
    pageViewsTimeseries,
    topSources,
    webVitalsSummary
  }
})
