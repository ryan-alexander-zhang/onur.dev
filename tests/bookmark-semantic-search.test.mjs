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
      return valid(body, (id) => (Number(id) === 0 ? 0.8 : Number(id) === 2 ? 0.95 : 0.2))
    }
  })
  assert.deepEqual(await search(catalog, input), { ids: ['2', '0'] })
  assert.equal(calls, 2)
  assert.deepEqual(await search(catalog, { ...input, group: 'missing' }), { ids: [] })
  assert.equal(calls, 2)
})
test('coalesces identical work and only reevaluates changed metadata or new query/scope candidates', async () => {
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
  assert.equal(calls, 3)
  await search(catalog, { ...input, query: 'another query' })
  assert.equal(calls, 5)
  await search(catalog, { ...input, group: 'tools' })
  assert.equal(calls, 6)
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

test('source and tag ordering do not affect cache hits or cold request payloads', async () => {
  const reordered = structuredClone(catalog)
  reordered.items.reverse()
  reordered.groups.reverse()
  for (const item of reordered.items) {
    item.tags = [...item.tags].reverse().concat(item.tags)
    item.created = '2027-01-01'
    item.cover = 'new-cover'
  }
  const requests = []
  const fetcher = async (_, options) => {
    requests.push(options.body)
    const body = JSON.parse(options.body)
    for (const [id, value] of Object.entries(body.questions)) {
      assert.equal(value.instructions.candidate.title, `Resource ${id}`)
      assert.deepEqual(value.instructions.candidate.tags, ['eval', 'tool'])
    }
    return valid(body)
  }
  const search = createBookmarkSemanticSearch({ getKey: () => 'key', fetcher })
  const first = await search(catalog, input)
  const expected = [...first.ids].sort()
  assert.deepEqual(first.ids, expected)
  assert.deepEqual(
    await search(reordered, { ...input, query: `  ${input.query}  `, tags: ['tool', 'eval', 'tool'] }),
    first
  )
  assert.equal(requests.length, 2)
  const freshSearch = createBookmarkSemanticSearch({ getKey: () => 'key', fetcher })
  assert.deepEqual(await freshSearch(reordered, input), first)
  assert.deepEqual(requests.slice(2), requests.slice(0, 2))
})

test('adding, editing and deleting bookmarks only evaluates new or changed candidates', async () => {
  const requestedIds = []
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: async (_, options) => {
      const body = JSON.parse(options.body)
      requestedIds.push(...Object.keys(body.questions))
      return valid(body)
    }
  })
  await search(catalog, input)
  assert.equal(requestedIds.length, 50)
  requestedIds.length = 0
  const changed = structuredClone(catalog)
  changed.items.push({ ...changed.items[0], _id: 'new', title: 'New candidate' })
  changed.items[2].excerpt = 'Updated description'
  changed.items = changed.items.filter((item) => item._id !== '0')
  const result = await search(changed, input)
  assert.deepEqual(requestedIds.sort(), ['2', 'new'])
  assert.equal(result.ids.length, 50)
  assert.ok(result.ids.includes('new'))
  assert.ok(!result.ids.includes('0'))
  requestedIds.length = 0
  changed.items[2].tags = [...changed.items[2].tags, 'new-tag']
  // This item is outside the selected eval tag and must never be evaluated.
  await search(changed, input)
  assert.deepEqual(requestedIds, [])
})

test('raw scores, including zero and below-threshold values, are reused across filters', async () => {
  let candidatesSent = 0
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: async (_, options) => {
      const body = JSON.parse(options.body)
      candidatesSent += Object.keys(body.questions).length
      return valid(body, (id) => (id === '0' ? 0 : id === '2' ? 0.52 : 0.91))
    }
  })
  await search(catalog, { query: input.query })
  assert.equal(candidatesSent, 101)
  const result = await search(catalog, input)
  assert.equal(candidatesSent, 101)
  assert.equal(result.ids.length, 48)
  assert.ok(!result.ids.includes('0') && !result.ids.includes('2') && !result.ids.includes('100'))
})

test('concurrent searches with overlapping scopes share in-flight candidate scores', async () => {
  const releases = []
  const sent = []
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: (_, options) => {
      const body = JSON.parse(options.body)
      sent.push(...Object.keys(body.questions))
      return new Promise((resolve) => releases.push(() => resolve(valid(body))))
    }
  })
  const narrow = search(catalog, input)
  const broad = search(catalog, { ...input, tags: ['tool'] })
  assert.equal(sent.length, 100)
  assert.equal(new Set(sent).size, 100)
  releases.splice(0).forEach((release) => release())
  const [narrowResult, broadResult] = await Promise.all([narrow, broad])
  assert.equal(narrowResult.ids.length, 50)
  assert.equal(broadResult.ids.length, 100)
  assert.ok(narrowResult.ids.every((id) => Number(id) % 2 === 0))
})

test('metadata tag changes invalidate only that bookmark, with normalization before truncation', async () => {
  const one = { ...catalog, items: [{ ...catalog.items[0], tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`) }] }
  const sent = []
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    fetcher: async (_, options) => {
      const body = JSON.parse(options.body)
      sent.push(body)
      return valid(body)
    }
  })
  await search(one, { query: input.query })
  one.items[0].tags.reverse()
  await search(one, { query: input.query })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].questions['0'].instructions.candidate.tags.length, 40)
  one.items[0].tags.push('a-new-tag')
  await search(one, { query: input.query })
  assert.equal(sent.length, 2)
})

test('score cache expiration and LRU eviction trigger reevaluation without losing in-flight results', async () => {
  const two = { ...catalog, items: [catalog.items[0], catalog.items[2]] }
  let calls = 0
  const search = createBookmarkSemanticSearch({
    getKey: () => 'key',
    cacheMax: 1,
    cacheTtlMs: 15,
    fetcher: async (_, options) => {
      calls++
      return valid(JSON.parse(options.body))
    }
  })
  assert.deepEqual(await search(two, input), { ids: ['0', '2'] })
  await search({ ...two, items: [two.items[1]] }, input)
  assert.equal(calls, 1)
  await search({ ...two, items: [two.items[0]] }, input)
  assert.equal(calls, 2)
  await new Promise((resolve) => setTimeout(resolve, 25))
  await search({ ...two, items: [two.items[0]] }, input)
  assert.equal(calls, 3)
})
