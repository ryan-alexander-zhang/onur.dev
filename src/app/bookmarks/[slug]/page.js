import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { BookmarkList } from '@/components/bookmark-list'
import { BookmarkTitle } from '@/components/bookmark-title'
import { FloatingHeader } from '@/components/floating-header'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { getBookmarkCatalog, getBookmarks } from '@/lib/bookmarks'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'
import { sortByProperty } from '@/lib/utils'

async function fetchData(slug) {
  const preview = (await draftMode()).isEnabled
  const bookmarks = await getBookmarks(preview)
  const currentBookmark = bookmarks.find((bookmark) => bookmark.slug === slug)
  if (!currentBookmark) notFound()

  const sortedBookmarks = sortByProperty(bookmarks, 'title')
  const catalog = await getBookmarkCatalog(preview)

  return {
    bookmarks: sortedBookmarks,
    currentBookmark,
    catalog,
    semanticEnabled: !preview && Boolean(process.env.JEV_KEY)
  }
}

async function CollectionPage(props) {
  const params = await props.params
  const { slug } = params
  const { bookmarks, currentBookmark, catalog, semanticEnabled } = await fetchData(slug)

  return (
    <ScrollArea className="bg-grid" useScrollAreaId>
      <FloatingHeader
        scrollTitle={currentBookmark.title}
        goBackLink="/bookmarks"
        bookmarks={bookmarks}
        currentBookmark={currentBookmark}
      />
      <div className="content-wrapper">
        <div className="content @container">
          <BookmarkTitle title={currentBookmark.title} groups={catalog.groups} id={currentBookmark._id} />
          <Suspense fallback={<ScreenLoadingSpinner />}>
            <BookmarkList
              key={currentBookmark._id}
              id={currentBookmark._id}
              catalog={catalog}
              semanticEnabled={semanticEnabled}
            />
          </Suspense>
        </div>
      </div>
    </ScrollArea>
  )
}

export async function generateMetadata(props) {
  const params = await props.params
  const { slug } = params
  const [{ author, siteBaseUrl }, bookmarks] = await Promise.all([
    getSiteMetadata(),
    getBookmarks((await draftMode()).isEnabled)
  ])
  const currentBookmark = bookmarks.find((bookmark) => bookmark.slug === slug)
  if (!currentBookmark) return null

  const siteUrl = buildAbsoluteUrl(siteBaseUrl, `bookmarks/${currentBookmark.slug}`)
  const seoTitle = `${currentBookmark.title} | Bookmarks`
  const seoDescription = `A curated selection of various handpicked ${currentBookmark.title.toLowerCase()} bookmarks by ${author.name}`

  return {
    title: seoTitle,
    description: seoDescription,
    keywords: [
      currentBookmark.title,
      'bookmarks',
      `${currentBookmark.title} bookmarks`,
      'collection',
      `${currentBookmark.title} collection`
    ],
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: siteUrl,
      images: `${siteUrl}/og.png`
    },
    alternates: {
      canonical: siteUrl
    }
  }
}

export default function Page(props) {
  return (
    <Suspense fallback={<ScreenLoadingSpinner />}>
      <CollectionPage {...props} />
    </Suspense>
  )
}
