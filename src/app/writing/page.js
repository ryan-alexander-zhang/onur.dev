import { cacheLife } from 'next/cache'
import { Suspense } from 'react'

import { FloatingHeader } from '@/components/floating-header'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { WritingListLayout } from '@/components/writing/writing-list-layout'
import { getAllPosts, getPageSeo } from '@/lib/contentful'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'
import { getSortedPosts } from '@/lib/utils'

async function fetchData() {
  'use cache'
  cacheLife('max')

  const allPosts = await getAllPosts()
  const sortedPosts = getSortedPosts(allPosts)
  return { sortedPosts }
}

export default async function Writing() {
  'use cache'

  cacheLife('max')
  const { sortedPosts } = await fetchData()

  return (
    <ScrollArea className="lg:hidden">
      <FloatingHeader title="Writing" />
      <Suspense fallback={<ScreenLoadingSpinner />}>
        <WritingListLayout list={sortedPosts} isMobile />
      </Suspense>
    </ScrollArea>
  )
}

export async function generateMetadata() {
  const [{ siteBaseUrl }, seoData] = await Promise.all([getSiteMetadata(), getPageSeo('writing')])
  if (!seoData) return null

  const {
    seo: { title, description }
  } = seoData
  const siteUrl = buildAbsoluteUrl(siteBaseUrl, 'writing')

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
