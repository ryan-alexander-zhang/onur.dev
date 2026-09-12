import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchPermanentNotes, normalizePermanentNote } from '../src/lib/permanent-notes-data.js'

const env = {
  CONTENTFUL_SPACE_ID: 'test-space',
  CONTENTFUL_ACCESS_TOKEN: 'delivery-test-token',
  CONTENTFUL_PREVIEW_ACCESS_TOKEN: 'preview-test-token',
  CONTENTFUL_ENVIRONMENT_ID: 'staging',
  CONTENTFUL_LOCALE: 'en-US'
}
const response = (body, status = 200) => new Response(JSON.stringify(body), { status })

test('published pagination honors environment/locale and fetches beyond first 100 notes', async () => {
  const calls = []
  const notes = await fetchPermanentNotes({
    env,
    fetcher: async (url, options) => {
      const { variables } = JSON.parse(options.body)
      calls.push(variables)
      assert.ok(url.endsWith('/environments/staging'))
      assert.equal(options.headers.Authorization, 'Bearer delivery-test-token')
      assert.equal(variables.preview, false)
      assert.equal(variables.locale, 'en-US')
      const length = variables.skip === 0 ? 100 : 1
      return response({
        data: {
          permanentNoteCollection: {
            total: 101,
            items: Array.from({ length }, (_, index) => ({ noteId: String(index + variables.skip), title: 'Card' }))
          }
        }
      })
    }
  })
  assert.equal(notes.length, 101)
  assert.deepEqual(
    calls.map((call) => call.skip),
    [0, 100]
  )
  assert.equal(notes[100].noteId, '100')
})

test('preview is explicit and uses its own credential', async () => {
  await fetchPermanentNotes({
    env,
    preview: true,
    fetcher: async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer preview-test-token')
      assert.equal(JSON.parse(options.body).variables.preview, true)
      return response({ data: { permanentNoteCollection: { total: 0, items: [] } } })
    }
  })
})

test('missing credentials and exact missing content model are setup states', async () => {
  assert.deepEqual(await fetchPermanentNotes({ env: {}, fetcher: () => assert.fail('must not fetch') }), [])
  for (const status of [200, 400]) {
    assert.deepEqual(
      await fetchPermanentNotes({
        env,
        fetcher: async () =>
          response({ errors: [{ message: 'Cannot query field "permanentNoteCollection" on type "Query".' }] }, status)
      }),
      []
    )
  }
})

test('auth, service, partial GraphQL errors, and truncated pagination are surfaced', async () => {
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(fetchPermanentNotes({ env, fetcher: async () => response({}, status) }), /request failed/)
  }
  await assert.rejects(
    fetchPermanentNotes({ env, fetcher: async () => response({ errors: [{ message: 'Unknown field bodyEn' }] }) }),
    /GraphQL/
  )
  await assert.rejects(
    fetchPermanentNotes({
      env,
      fetcher: async () =>
        response({
          data: {
            permanentNoteCollection: { total: 1, items: [] }
          }
        })
    }),
    /pagination/
  )
})

test('normalization preserves bilingual Markdown and canonical English-flattened links', () => {
  assert.deepEqual(
    normalizePermanentNote({
      noteId: '123',
      title: '中文',
      bodyZh: '[卡片](/cards/456)',
      bodyEn: '[Card](/cards/456)',
      linkedNoteIds: ['456', '456', null],
      tags: ['one', 'one'],
      aliases: null
    }),
    {
      noteId: '123',
      title: '中文',
      titleEn: '',
      bodyZh: '[卡片](/cards/456)',
      bodyEn: '[Card](/cards/456)',
      linkedNoteIds: ['456'],
      tags: ['one'],
      aliases: [],
      sources: ''
    }
  )
})
