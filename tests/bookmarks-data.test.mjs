import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fetchBookmarkCatalog, normalizeCatalog, paginateBookmarks } from '../src/lib/bookmarks-data.js'

const snapshot = {
  version: 1,
  groups: [{ id: 'ai', slug: 'ai', title: 'AI' }],
  items: Array.from({ length: 61 }, (_, i) => ({
    id: String(i),
    groupId: 'ai',
    title: `Bookmark ${i}`,
    url: `https://example.com/${i}`,
    description: 'Summary',
    cover: 'https://example.com/image.png',
    created: '2026-01-01T00:00:00.000Z',
    private: 'SECRET'
  }))
}
test('snapshot preserves Base order, derives group counts and serves complete pages', () => {
  const catalog = normalizeCatalog(snapshot)
  assert.equal(catalog.groups[0].count, 61)
  assert.equal(paginateBookmarks(catalog, 'ai', 0).items.length, 50)
  assert.equal(paginateBookmarks(catalog, 'ai', 1).items.length, 11)
  assert.equal(paginateBookmarks(catalog, 'ai', 2).items.length, 0)
  assert.equal(paginateBookmarks(catalog, 'ai', 1).items[0]._id, '50')
  assert.equal(paginateBookmarks(catalog, 'missing').count, 0)
  assert.doesNotMatch(JSON.stringify(catalog), /SECRET/)
  assert.throws(() => paginateBookmarks(catalog, 'ai', -1), /Invalid/)
})
test('malformed snapshots and unsafe links fail instead of hiding corrupted data', () => {
  assert.throws(() => normalizeCatalog({ ...snapshot, version: 2 }), /Unsupported/)
  assert.throws(() => normalizeCatalog({ ...snapshot, items: [snapshot.items[0], snapshot.items[0]] }), /duplicate/)
  assert.throws(
    () => normalizeCatalog({ ...snapshot, items: [{ ...snapshot.items[0], url: 'javascript:alert(1)' }] }),
    /Invalid/
  )
  assert.throws(
    () => normalizeCatalog({ ...snapshot, items: [{ ...snapshot.items[0], groupId: 'unknown' }] }),
    /Invalid/
  )
})
const env = {
  CONTENTFUL_SPACE_ID: 'fixture',
  CONTENTFUL_ACCESS_TOKEN: 'delivery',
  CONTENTFUL_PREVIEW_ACCESS_TOKEN: 'preview',
  CONTENTFUL_ENVIRONMENT_ID: 'test'
}
test('reads exactly one catalog with preview isolation and explicit environment', async () => {
  const data = await fetchBookmarkCatalog({
    env,
    preview: true,
    fetcher: async (url, request) => {
      assert.match(url, /environments\/test$/)
      assert.equal(request.headers.Authorization, 'Bearer preview')
      const body = JSON.parse(request.body)
      assert.equal(body.variables.id, 'bookmarkCatalog_main')
      assert.equal(body.variables.preview, true)
      return Response.json({ data: { bookmarkCatalog: { snapshot } } })
    }
  })
  assert.equal(data.items.length, 61)
})
test('missing model/entry are setup states; transport and invalid responses surface errors', async () => {
  const missing = await fetchBookmarkCatalog({
    env,
    fetcher: async () => Response.json({ data: { bookmarkCatalog: null } })
  })
  assert.equal(missing.items.length, 0)
  await assert.rejects(fetchBookmarkCatalog({ env, fetcher: async () => new Response('', { status: 401 }) }), /401/)
  await assert.rejects(fetchBookmarkCatalog({ env, fetcher: async () => Response.json({ data: {} }) }), /Invalid/)
})
