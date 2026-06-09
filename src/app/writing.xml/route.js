import { Feed } from 'feed'

import { getAllPosts } from '@/lib/contentful'
import { buildAbsoluteUrl, getSiteMetadata } from '@/lib/site'
import { getSortedPosts } from '@/lib/utils'

export async function GET() {
  const [{ author, siteBaseUrl, siteUrl }, allPosts] = await Promise.all([getSiteMetadata(), getAllPosts()])
  const sortedPosts = getSortedPosts(allPosts)

  const latestPost = sortedPosts[0]
  const latestDate = new Date(latestPost?.sys?.publishedAt || '2025-01-01')

  const feed = new Feed({
    title: `Writings RSS feed by ${author.name}`,
    description: `Stay up to date with the latest writings from ${author.name}`,
    id: siteUrl,
    link: buildAbsoluteUrl(siteBaseUrl, 'writing'),
    language: 'en',
    updated: latestDate,
    copyright: `All rights reserved ${latestDate.getFullYear()}, ${author.name}`,
    author,
    feedLinks: {
      rss2: buildAbsoluteUrl(siteBaseUrl, 'writing/rss.xml')
    }
  })

  sortedPosts.forEach((post) => {
    feed.addItem({
      id: post.slug,
      guid: post.slug,
      title: post.title,
      link: buildAbsoluteUrl(siteBaseUrl, `writing/${post.slug}`),
      date: new Date(post.date || post.sys.firstPublishedAt),
      updated: new Date(post.sys.publishedAt),
      author: [author],
      contributor: [author]
    })
  })

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400'
    }
  })
}
