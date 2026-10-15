import ip from '@arcjet/ip'

import { createBookmarkSearchHandler } from '@/lib/bookmark-search-handler'
import { searchBookmarks } from '@/lib/bookmark-semantic-search'
import { getBookmarkCatalog } from '@/lib/bookmarks'

export const POST = createBookmarkSearchHandler({
  getCatalog: () => getBookmarkCatalog(false),
  search: searchBookmarks,
  getClientIp: (request) => ip(request, process.env.VERCEL ? { platform: 'vercel' } : undefined)
})
