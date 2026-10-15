import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createBookmarkSearchHandler } from '../src/lib/bookmark-search-handler.js'
import { createBookmarkSemanticSearch } from '../src/lib/bookmark-semantic-search.js'

const catalog = {
  groups: [
    { _id: 'ai', title: 'AI' },
    { _id: 'tools', title: 'Tools' }
  ],
  items: Array.from({ length: 101 }, (_, i) => ({
    _id: String(i),
    title: `Resource ${i}`,
    excerpt: 'English description of coding agent evaluation.',
    collectionId: i < 100 ? 'ai' : 'tools',
    tags: i % 2 ? ['tool'] : ['tool', 'eval'],
    created: '2026-01-01',
    link: 'https://private.example',
    cover: 'PRIVATE_COVER',
    body: 'PRIVATE_BODY'
  }))
}
const input = { query: '评估代码助手', group: 'ai', tags: ['eval', 'tool'] }
const valid = (body, score = () => 0.9) =>
  Response.json({
    model: body.model,
    answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: score(id) }]))
  })
test('filters scope before AI, sends only metadata, validates ranking and keeps credentials server-side', async () => {
  let calls = 0
  const search = createBookmarkSemanticSearch({
    getKey: () => 'secret-key',
    fetcher: async (url, options) => {
      calls++
      assert.equal(url, 'https://api.typesafe.ai/v1/systemone')
      assert.equal(options.headers.Authorization, 'Bearer secret-key')
      assert.equal(options.redirect, 'error')
      const body = JSON.parse(options.body)
      assert.doesNotMatch(options.body, /PRIVATE_|private\.example|secret-key/)
      for (const { instructions } of Object.values(body.questions)) {
        assert.deepEqual(Object.keys(instructions.candidate).sort(), ['description', 'group', 'tags', 'title'])
        assert.equal(instructions.candidate.group, 'AI')
        assert.ok(instructions.candidate.tags.includes('eval'))
      }
      return valid(body, (id) => (Number(id) === 0 ? 0.8 : Number(id) === 1 ? 0.95 : 0.2))
    }
  })
  assert.deepEqual(await search(catalog, input), { ids: ['2', '0'] })
  assert.equal(calls, 2)
  assert.deepEqual(await search(catalog, { ...input, group: 'missing' }), { ids: [] })
  assert.equal(calls, 2)
})
test('coalesces identical work and invalidates cache on metadata, query and scope changes', async () => {
  let calls = 0
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: async (_, options) => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 5))
      return valid(JSON.parse(options.body))
    }
  })
  await Promise.all([search(catalog, input), search(catalog, input)])
  assert.equal(calls, 2)
  await search(catalog, { ...input, tags: ['tool', 'eval'] })
  assert.equal(calls, 2)
  const edited = structuredClone(catalog)
  edited.items[0].excerpt = 'Changed'
  await search(edited, input)
  assert.equal(calls, 4)
  await search(catalog, { ...input, query: 'another query' })
  assert.equal(calls, 6)
  await search(catalog, { ...input, group: 'tools' })
  assert.equal(calls, 7)
})
test('empty matches are cached and low-scoring candidates are not padded into results', async () => {
  let calls = 0
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: async (_, options) => {
      calls++
      return valid(JSON.parse(options.body), () => 0.52)
    }
  })
  assert.deepEqual(await search(catalog, input), { ids: [] })
  assert.deepEqual(await search(catalog, input), { ids: [] })
  assert.equal(calls, 2)
})
test('missing keys, incomplete responses, invalid scores and upstream errors fail closed without caching', async () => {
  await assert.rejects(createBookmarkSemanticSearch({ getKey: () => '' })(catalog, input), { status: 503 })
  for (const response of [
    () => Response.json({ model: 'jev-1.13.0', answers: {} }),
    (body) => valid(body, () => 2),
    () => new Response('secret provider failure', { status: 401 })
  ]) {
    let broken = true
    const search = createBookmarkSemanticSearch({
      getKey: () => 'key',
      fetcher: async (_, options) => {
        const body = JSON.parse(options.body)
        return broken ? response(body) : valid(body)
      }
    })
    await assert.rejects(search(catalog, input), { status: 503, message: 'Semantic search unavailable' })
    broken = false
    assert.equal((await search(catalog, input)).ids.length, 50)
  }
})
test('timeout aborts in-flight batches', async () => {
  let aborted = 0
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    timeoutMs: 10,
    fetcher: (_, options) =>
      new Promise((_, reject) =>
        options.signal.addEventListener('abort', () => {
          aborted++
          reject(options.signal.reason)
        })
      )
  })
  await assert.rejects(search(catalog, input), { status: 504 })
  assert.equal(aborted, 2)
})
test('large multilingual metadata stays within byte and concurrency limits', async () => {
  const large = structuredClone(catalog)
  for (const item of large.items) item.excerpt = '中'.repeat(2000)
  let active = 0,
    peak = 0
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: async (_, options) => {
      assert.ok(Buffer.byteLength(options.body) <= 48000)
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active--
      return valid(JSON.parse(options.body))
    }
  })
  assert.equal((await search(large, input)).ids.length, 50)
  assert.equal(peak, 4)
})

const request = (body, headers = {}) =>
  new Request('https://example.com/api/bookmarks/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
test('handler rejects malformed, cross-origin, oversized and caller-supplied catalog requests before search', async () => {
  let calls = 0
  const handler = createBookmarkSearchHandler({
    getClientIp: () => 'test',
    getCatalog: () => catalog,
    search: async () => {
      calls++
      return { ids: [] }
    }
  })
  assert.equal((await handler(request({ ...input, candidates: [] }))).status, 400)
  assert.equal((await handler(request({ ...input, query: 'x' }))).status, 400)
  assert.equal((await handler(request({ ...input, query: 'x'.repeat(501) }))).status, 400)
  assert.equal((await handler(request(input, { Origin: 'https://attacker.example' }))).status, 403)
  assert.equal((await handler(request(input, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403)
  assert.equal((await handler(request(input, { 'Content-Type': 'text/plain' }))).status, 415)
  assert.equal((await handler(request({ query: 'x'.repeat(9000) }))).status, 413)
  assert.equal(calls, 0)
})
test('handler uses server catalog, prevents response caching, rate-limits calls and hides errors', async () => {
  let calls = 0
  const handler = createBookmarkSearchHandler({
    getClientIp: () => 'test',
    getCatalog: () => catalog,
    search: async (data) => {
      assert.equal(data, catalog)
      calls++
      return { ids: ['0'] }
    }
  })
  for (let i = 0; i < 10; i++) {
    const response = await handler(request(input))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { ids: ['0'] })
  }
  const limited = await handler(request(input))
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
  assert.equal(calls, 10)
  const failure = createBookmarkSearchHandler({
    getClientIp: () => 'test',
    getCatalog: () => {
      throw new Error('SECRET_KEY')
    },
    search: () => {}
  })
  assert.doesNotMatch(await (await failure(request(input))).text(), /SECRET_KEY/)
})

test('caps concurrent uncached searches and releases slots after completion', async () => {
  const one = { ...catalog, items: catalog.items.slice(0, 1) }
  const releases = []
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: (_, options) => new Promise((resolve) => releases.push(() => resolve(valid(JSON.parse(options.body)))))
  })
  const tasks = [1, 2, 3].map((n) => search(one, { ...input, query: `query ${n}` }))
  await assert.rejects(search(one, { ...input, query: 'query 4' }), { status: 429 })
  releases.splice(0).forEach((release) => release())
  await Promise.all(tasks)
  const retry = search(one, { ...input, query: 'query 4' })
  releases.splice(0).forEach((release) => release())
  assert.deepEqual(await retry, { ids: ['0'] })
})

test('instance budget blocks new work but permits cached results', async () => {
  const one = { ...catalog, items: catalog.items.slice(0, 1) }
  let calls = 0
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: async (_, options) => {
      calls++
      return valid(JSON.parse(options.body))
    }
  })
  for (let n = 0; n < 30; n++) await search(one, { ...input, query: `query ${n}` })
  await assert.rejects(search(one, { ...input, query: 'over budget' }), { status: 429 })
  assert.deepEqual(await search(one, { ...input, query: 'query 0' }), { ids: ['0'] })
  assert.equal(calls, 30)
})
