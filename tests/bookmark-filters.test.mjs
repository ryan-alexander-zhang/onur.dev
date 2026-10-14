import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bookmarkTagOptions, filterBookmarks, readBookmarkFilters } from '../src/lib/bookmark-filters.js'

const items = [
  {
    _id: '1',
    collectionId: 'ai',
    title: 'Agent SDK',
    excerpt: 'Build assistants',
    domain: 'example.com',
    tags: ['tool', 'agent', 'resource/course'],
    created: '2026-01-01'
  },
  {
    _id: '2',
    collectionId: 'ai',
    title: 'Agent guide',
    excerpt: 'Learn agents',
    domain: 'docs.test',
    tags: ['article', 'agent', 'course'],
    created: '2026-03-01'
  },
  {
    _id: '3',
    collectionId: 'design',
    title: 'Design tools',
    excerpt: 'Design assistants',
    domain: 'example.com',
    tags: ['tool'],
    created: '2026-02-01'
  }
]
test('group, exact AND tags and case-insensitive search combine over the full catalog', () => {
  assert.deepEqual(
    filterBookmarks(items, { group: 'ai', tags: ['tool', 'agent'], query: 'SDK EXAMPLE' }).map((i) => i._id),
    ['1']
  )
  assert.deepEqual(
    filterBookmarks(items, { tags: ['course'] }).map((i) => i._id),
    ['2']
  )
  assert.equal(filterBookmarks(items, { group: 'design', tags: ['agent'] }).length, 0)
  assert.equal(filterBookmarks(items, { query: 'assistants' }).length, 2)
})
test('facets count the intersection and retain selected tags in empty scopes', () => {
  const options = bookmarkTagOptions(items, { group: 'ai', tags: ['tool'] })
  assert.equal(options[0].tag, 'tool')
  assert.equal(options.find((o) => o.tag === 'agent').count, 1)
  assert.equal(options.find((o) => o.tag === 'article').count, 0)
  assert.deepEqual(bookmarkTagOptions(items, { group: 'missing', tags: ['tool'] }), [{ tag: 'tool', count: 0 }])
})
test('URL parsing, sort order and input immutability', () => {
  const filters = readBookmarkFilters(
    new URLSearchParams('tag=course&tag=course&tag=resource%2Fcourse&q=hello&sort=unknown')
  )
  assert.deepEqual(filters, { tags: ['course', 'resource/course'], query: 'hello', sort: 'latest' })
  assert.deepEqual(
    filterBookmarks(items).map((i) => i._id),
    ['2', '3', '1']
  )
  assert.deepEqual(
    filterBookmarks(items, { sort: 'oldest' }).map((i) => i._id),
    ['1', '3', '2']
  )
  assert.deepEqual(
    filterBookmarks(items, { sort: 'title' }).map((i) => i._id),
    ['2', '1', '3']
  )
  assert.deepEqual(
    items.map((i) => i._id),
    ['1', '2', '3']
  )
})
