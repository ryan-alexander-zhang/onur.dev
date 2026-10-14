import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { cache } from 'react'

import { BOOKMARKS_CACHE_TAG, fetchBookmarkCatalog, paginateBookmarks } from '@/lib/bookmarks-data'

async function publishedCatalog() {
  'use cache'
  cacheLife('hours')
  cacheTag(BOOKMARKS_CACHE_TAG)
  return fetchBookmarkCatalog()
}
export const getBookmarkCatalog = cache(async (preview = false) => {
  return preview ? fetchBookmarkCatalog({ preview: true }) : publishedCatalog()
})
export async function getBookmarks(preview = false) {
  return (await getBookmarkCatalog(preview)).groups
}
export async function getBookmarkItems(id, pageIndex = 0, preview = false) {
  return paginateBookmarks(await getBookmarkCatalog(preview), id, pageIndex)
}
