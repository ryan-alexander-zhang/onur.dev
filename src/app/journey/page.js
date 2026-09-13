import { Suspense } from 'react'

import { FloatingHeader } from '@/components/floating-header'
import { JourneyTimeline } from '@/components/journey-timeline'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { getPageSeo } from '@/lib/contentful'
import { getJournalEntries } from '@/lib/journal'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'

async function JournalFeed() {
  const entries = await getJournalEntries()
  return (
    <>
      <div className="p-4 lg:hidden">
        <JourneyTimeline entries={entries} />
      </div>
      <div className="hidden flex-1 flex-col items-center justify-center px-8 text-center lg:flex">
        <h1 className="text-xl font-semibold">{entries.length ? 'Journey' : 'More along the way'}</h1>
        <p className="mt-3 text-sm text-gray-500">
          {entries.length
            ? 'Select a date on the timeline to read an entry.'
            : 'Notes and reflections will appear here.'}
        </p>
      </div>
    </>
  )
}

export default function Journey() {
  return (
    <ScrollArea useScrollAreaId>
      <FloatingHeader title="Journey" />
      <Suspense fallback={<ScreenLoadingSpinner />}>
        <JournalFeed />
      </Suspense>
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
