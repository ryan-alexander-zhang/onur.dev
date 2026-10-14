import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { BookmarkList } from '@/components/bookmark-list'
import { FloatingHeader } from '@/components/floating-header'
import { PageTitle } from '@/components/page-title'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { ScrollArea } from '@/components/scroll-area'
import { getBookmarkItems, getBookmarks } from '@/lib/bookmarks'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'
import { sortByProperty } from '@/lib/utils'

async function fetchData(slug) {
  const bookmarks = await getBookmarks((await draftMode()).isEnabled)
  const currentBookmark = bookmarks.find((bookmark) => bookmark.slug === slug)
  if (!currentBookmark) notFound()

  const sortedBookmarks = sortByProperty(bookmarks, 'title')
  const bookmarkItems = await getBookmarkItems(currentBookmark._id, 0, (await draftMode()).isEnabled)

  return {
    bookmarks: sortedBookmarks,
    currentBookmark,
    bookmarkItems
  }
}

async function CollectionPage(props) {
  const params = await props.params
  const { slug } = params
  const { bookmarks, currentBookmark, bookmarkItems } = await fetchData(slug)

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
          <PageTitle title={currentBookmark.title} />
          <Suspense fallback={<ScreenLoadingSpinner />}>
            <BookmarkList key={currentBookmark._id} id={currentBookmark._id} initialData={bookmarkItems} />
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
