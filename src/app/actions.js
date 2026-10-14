'use server'

import { draftMode } from 'next/headers'

import { getBookmarkItems } from '@/lib/bookmarks'

export async function getBookmarkItemsByPageIndex(id, pageIndex) {
  return await getBookmarkItems(id, pageIndex, (await draftMode()).isEnabled)
}
