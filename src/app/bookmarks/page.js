import { draftMode } from 'next/headers'
import { Suspense } from 'react'

import { BookmarkList } from '@/components/bookmark-list'
import { BookmarkTitle } from '@/components/bookmark-title'
import { FloatingHeader } from '@/components/floating-header'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { getBookmarkCatalog } from '@/lib/bookmarks'
import { getPageSeo } from '@/lib/contentful'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'
import { sortByProperty } from '@/lib/utils'

async function BookmarksIndex() {
  const catalog = await getBookmarkCatalog((await draftMode()).isEnabled)
  const bookmarks = sortByProperty(catalog.groups, 'title')
  return (
    <ScrollArea className="bg-grid" useScrollAreaId>
      <FloatingHeader title="Bookmarks" bookmarks={bookmarks} />
      <div className="content-wrapper">
        <div className="content @container">
          <BookmarkTitle title="All bookmarks" groups={catalog.groups} />
          <BookmarkList catalog={catalog} />
        </div>
      </div>
    </ScrollArea>
  )
}

export async function generateMetadata() {
  const [{ siteBaseUrl }, seoData] = await Promise.all([getSiteMetadata(), getPageSeo('bookmarks')])
  if (!seoData) return null

  const {
    seo: { title, description }
  } = seoData
  const siteUrl = buildAbsoluteUrl(siteBaseUrl, 'bookmarks')

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

export default function Page() {
  return (
    <Suspense fallback={<ScreenLoadingSpinner />}>
      <BookmarksIndex />
    </Suspense>
  )
}
