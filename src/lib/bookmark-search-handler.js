import 'server-only'

import { LRUCache } from 'lru-cache'
import { z } from 'zod'

import { BookmarkSearchError } from './bookmark-semantic-search.js'

const schema = z
  .object({
    query: z.string().trim().min(2).max(500),
    group: z.string().max(80).default(''),
    tags: z.array(z.string().min(1).max(80)).max(20).default([])
  })
  .strict()
const reply = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) }
  })

export function createBookmarkSearchHandler({ getCatalog, search, getClientIp }) {
  const requests = new LRUCache({ max: 2000, ttl: 60000 })
  return async function POST(request) {
    const origin = request.headers.get('origin')
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
      return reply({ error: 'Request not allowed.' }, 403)
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
      return reply({ error: 'Expected JSON.' }, 415)
    // On Vercel the caller is identified by the platform header; unknown callers share a bucket.
    const ip = getClientIp(request) || 'unknown'
    const bucket = requests.get(ip) || { count: 0 }
    if (bucket.count === 0) requests.set(ip, bucket)
    if (++bucket.count > 10) return reply({ error: 'Too many searches. Try again in a minute.' }, 429)
    let input
    try {
      const reader = request.body?.getReader()
      if (!reader) return reply({ error: 'Invalid search.' }, 400)
      const chunks = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 8192) {
          await reader.cancel()
          return reply({ error: 'Search is too long.' }, 413)
        }
        chunks.push(value)
      }
      input = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    } catch {
      return reply({ error: 'Invalid search.' }, 400)
    }
    if (!input.success) return reply({ error: 'Invalid search.' }, 400)
    try {
      // Always load the public server catalog. Never accept caller-supplied candidates or preview data.
      return reply(await search(await getCatalog(), input.data))
    } catch (error) {
      const status = error instanceof BookmarkSearchError ? error.status : 503
      return reply(
        {
          error: status === 429 ? 'Too many searches. Try again in a minute.' : 'AI search is temporarily unavailable.'
        },
        status
      )
    }
  }
}
