import { getAllPageSlugs, getAllPosts } from '@/lib/contentful'
import { getBookmarks } from '@/lib/raindrop'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'
import { getSortedPosts } from '@/lib/utils'

export default async function sitemap() {
  const [{ siteBaseUrl, siteUrl }, allPosts, bookmarks, allPages] = await Promise.all([
    getSiteMetadata(),
    getAllPosts(),
    getBookmarks(),
    getAllPageSlugs()
  ])

  const sortedWritings = getSortedPosts(allPosts)
  const latestPostDate = sortedWritings[0]?.sys?.publishedAt

  const writings = sortedWritings.map((post) => {
    return {
      url: buildAbsoluteUrl(siteBaseUrl, `writing/${post.slug}`),
      lastModified: post.sys.publishedAt,
      changeFrequency: 'yearly',
      priority: 0.5
    }
  })

  const mappedBookmarks = bookmarks.map((bookmark) => {
    return {
      url: buildAbsoluteUrl(siteBaseUrl, `bookmarks/${bookmark.slug}`),
      changeFrequency: 'weekly',
      priority: 1
    }
  })

  const pages = allPages.map((page) => {
    let changeFrequency = 'yearly'
    if (['writing', 'journey'].includes(page.slug)) changeFrequency = 'monthly'
    if (['bookmarks'].includes(page.slug)) changeFrequency = 'weekly'

    let priority = 0.5
    if (['writing', 'journey'].includes(page.slug)) priority = 0.8
    if (['bookmarks'].includes(page.slug)) priority = 1

    return {
      url: buildAbsoluteUrl(siteBaseUrl, page.slug),
      lastModified: page.sys.publishedAt,
      changeFrequency,
      priority
    }
  })

  return [
    {
      url: siteUrl,
      lastModified: latestPostDate,
      changeFrequency: 'weekly',
      priority: 1
    },
    ...pages,
    ...writings,
    ...mappedBookmarks
  ]
}
