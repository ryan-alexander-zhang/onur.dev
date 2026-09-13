import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fetchJournalEntries, groupJournalByYear, normalizeJournal } from '../src/lib/journal-data.js'

const env = {
  CONTENTFUL_SPACE_ID: 's',
  CONTENTFUL_ACCESS_TOKEN: 'delivery',
  CONTENTFUL_PREVIEW_ACCESS_TOKEN: 'preview'
}
test('pagination, preview credentials and explicit public field selection', async () => {
  const pages = [
    { total: 2, items: [{ noteId: '1', title: 'One', date: '2026-09-13T00:00:00Z', log: 'Public', inbox: 'PRIVATE' }] },
    { total: 2, items: [{ noteId: '2', title: 'Two', date: '2025-12-31', thoughts: 'Thought' }] }
  ]
  const entries = await fetchJournalEntries({
    env,
    preview: true,
    fetcher: async (_, request) => {
      assert.equal(request.headers.Authorization, 'Bearer preview')
      const body = JSON.parse(request.body)
      assert.match(body.query, /journalEntryCollection/)
      assert.doesNotMatch(body.query, /inbox|knowledge|logbook/i)
      return Response.json({ data: { journalEntryCollection: pages[body.variables.skip] } })
    }
  })
  assert.equal(entries.length, 2)
  assert.equal(entries[0].date, '2026-09-13')
  assert.doesNotMatch(JSON.stringify(entries), /PRIVATE/)
})
test('year/date sorting preserves same-date entries and excludes empty ones', () => {
  const entries = [
    normalizeJournal({ noteId: '1', date: '2025-12-31', log: 'old' }),
    normalizeJournal({ noteId: '2', date: '2026-09-13', thoughts: 'new' }),
    normalizeJournal({ noteId: '3', date: '2026-09-13', review: 'newer' }),
    normalizeJournal({ noteId: '4', date: '2026-09-14' })
  ]
  const groups = groupJournalByYear(entries)
  assert.deepEqual(
    groups.map((g) => g.year),
    ['2026', '2025']
  )
  assert.deepEqual(
    groups[0].entries.map((e) => e.noteId),
    ['3', '2']
  )
  assert.equal(entries[0].noteId, '1')
})
test('missing model is empty, while auth, partial errors and truncated pagination are surfaced', async () => {
  assert.deepEqual(await fetchJournalEntries({ env: {} }), [])
  assert.deepEqual(
    await fetchJournalEntries({
      env,
      fetcher: async () =>
        Response.json(
          { errors: [{ message: 'Cannot query field "journalEntryCollection" on type "Query".' }] },
          { status: 400 }
        )
    }),
    []
  )
  await assert.rejects(fetchJournalEntries({ env, fetcher: async () => new Response('', { status: 401 }) }), /401/)
  await assert.rejects(
    fetchJournalEntries({ env, fetcher: async () => Response.json({ errors: [{ message: 'Unknown field' }] }) }),
    /GraphQL/
  )
  await assert.rejects(
    fetchJournalEntries({
      env,
      fetcher: async () => Response.json({ data: { journalEntryCollection: { total: 1, items: [] } } })
    }),
    /pagination/
  )
})
