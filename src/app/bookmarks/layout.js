import { draftMode } from 'next/headers'
import { Suspense } from 'react'

import { BookmarkGroups } from '@/components/bookmark-groups'
import { ScreenLoadingSpinner } from '@/components/screen-loading-spinner'
import { SideMenu } from '@/components/side-menu'
import { Toaster } from '@/components/ui/sonner'
import { getBookmarks } from '@/lib/bookmarks'
import { sortByProperty } from '@/lib/utils'

async function fetchData() {
  const bookmarks = await getBookmarks((await draftMode()).isEnabled)
  const sortedBookmarks = sortByProperty(bookmarks, 'title')
  return { bookmarks: sortedBookmarks }
}

async function BookmarksShell({ children }) {
  const { bookmarks } = await fetchData()

  return (
    <>
      <div className="flex w-full">
        <SideMenu title="Bookmarks" bookmarks={bookmarks} isInner>
          <Suspense fallback={<ScreenLoadingSpinner />}>
            <BookmarkGroups groups={bookmarks} />
          </Suspense>
        </SideMenu>
        <div className="lg:bg-grid flex-1">{children}</div>
      </div>
      <Toaster
        closeButton
        toastOptions={{
          duration: 5000
        }}
      />
    </>
  )
}

export default function BookmarksLayout({ children }) {
  return (
    <Suspense fallback={<ScreenLoadingSpinner />}>
      <BookmarksShell>{children}</BookmarksShell>
    </Suspense>
  )
}
