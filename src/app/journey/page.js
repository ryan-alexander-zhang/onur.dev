import { Suspense } from 'react'

import { FloatingHeader } from '@/components/floating-header'
import { GradientBg3 } from '@/components/gradient-bg'
import { JourneyTimeline } from '@/components/journey-timeline'
import { PageTitle } from '@/components/page-title'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { getPageSeo } from '@/lib/contentful'
import { getJournalEntries } from '@/lib/journal'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'

async function JournalFeed() {
  const entries = await getJournalEntries()
  return <JourneyTimeline entries={entries} />
}

export default function Journey() {
  return (
    <ScrollArea useScrollAreaId>
      <GradientBg3 />
      <FloatingHeader scrollTitle="Journey" />
      <div className="content-wrapper">
        <div className="content">
          <PageTitle
            title="Journey"
            subtitle={<p className="mt-3 mb-0 text-sm text-gray-500">Notes, thoughts, and lessons along the way.</p>}
          />
          <Suspense fallback={<ScreenLoadingSpinner />}>
            <JournalFeed />
          </Suspense>
        </div>
      </div>
    </ScrollArea>
  )
}

export async function generateMetadata() {
  const [{ siteBaseUrl }, seoData] = await Promise.all([getSiteMetadata(), getPageSeo('journey')])
  if (!seoData) return null

  const {
    seo: { title, description }
  } = seoData
  const siteUrl = buildAbsoluteUrl(siteBaseUrl, 'journey')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: siteUrl
    },
    alternates: {
      canonical: siteUrl
    }
  }
}
