const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, dump } = require('js-yaml')
const {
  ROOT,
  schema,
  parseJournal,
  buildPlan,
  syncPlan,
  createClient,
  setup,
  revalidate,
  createQuickAddModule
} = require('../lib.cjs')
const id = '20260913082051'
const cardId = '20260908201230'
const file = { path: ROOT + '2026-09-13.md', basename: '2026-09-13', extension: 'md' }
const raw = (body, extra = '') =>
  `---\nid: ${id}\ntype: journal\ndate: 2026-09-13\ntags: [life, code]\n${extra}---\n# 2026-09-13\n${body}`
function fixture(markdown) {
  const contents = { [file.path]: markdown }
  const app = {
    workspace: { getActiveFile: () => file },
    vault: { getMarkdownFiles: () => [file], read: async (f) => contents[f.path] },
    metadataCache: {
      getFirstLinkpathDest: (target) => (target === 'card' ? { path: '02-Zettelkasten/Permanent/card.md' } : null),
      getFileCache: () => ({ frontmatter: { type: 'permanent-note', id: cardId } })
    },
    fileManager: {
      processFrontMatter: async (f, update) => {
        const original = contents[f.path],
          match = original.match(/^---\n([^]*?)\n---\n/),
          fm = load(match[1])
        update(fm)
        contents[f.path] = `---\n${dump(fm)}---\n${original.slice(match[0].length)}`
      }
    }
  }
  return { app, contents }
}
function fakeClient({ cardPublished = true, fail, seed = {} } = {}) {
  const entries = structuredClone(seed),
    calls = []
  return {
    entries,
    calls,
    async request(method, target, body, version) {
      calls.push({ method, target, body, version })
      if (fail?.(method, target)) throw new Error('Simulated failure')
      if (target === '/content_types/journalEntry' && method === 'GET')
        return { ...schema, sys: { publishedVersion: 1 } }
      if (target === '/locales') return { items: [{ code: 'en-US', default: true }] }
      if (target === `/entries/permanentNote_${cardId}`)
        return {
          fields: { noteId: { 'en-US': cardId } },
          sys: { contentType: { sys: { id: 'permanentNote' } }, publishedVersion: cardPublished ? 1 : undefined }
        }
      const key = target.replace(/\/published$/, '')
      if (method === 'GET') return structuredClone(entries[key] || null)
      if (entries[key]) assert.equal(version, entries[key].sys.version)
      if (target.endsWith('/published')) {
        entries[key].sys.publishedVersion = entries[key].sys.version
        entries[key].sys.version++
      } else
        entries[key] = {
          fields: body.fields,
          sys: {
            ...entries[key]?.sys,
            id: key.split('/').pop(),
            version: entries[key] ? entries[key].sys.version + 1 : 1,
            contentType: { sys: { id: 'journalEntry' } }
          }
        }
      return structuredClone(entries[key])
    }
  }
}

test('allowlist excludes private sections, preamble, unknown sections and nested Review prompts', () => {
  const note = parseJournal(
    file,
    raw(
      `PREAMBLE_PRIVATE\n## Log\nPublic log\n<!-- COMMENT_PRIVATE -->\n## Inbox\nINBOX_PRIVATE\n### Log\nNESTED_PRIVATE\n## Thoughts\nPublic thoughts\n## Knowledge to Develop\nKNOWLEDGE_PRIVATE\n## Review\n### 👍 What Went Well\nA small win\n### ⚠️ Challenges\n- <!-- TEMPLATE_PRIVATE -->\n### 💡 What I Realized Today\n> [!tip] Writing prompt\n> PROMPT_PRIVATE\n## Other\nOTHER_PRIVATE`
    ),
    load
  )
  const payload = JSON.stringify(note.fields)
  assert.doesNotMatch(payload, /PRIVATE|Challenges|Realized/)
  assert.equal(note.fields.log, 'Public log')
  assert.equal(note.fields.thoughts, 'Public thoughts')
  assert.equal(note.fields.review, '### 👍 What Went Well\n\nA small win')
  assert.equal(note.fields.date, '2026-09-13T00:00:00.000Z')
})

test('code headings and comments inside code remain literal; non-code comments disappear', () => {
  const note = parseJournal(
    file,
    raw(
      '## Log\n```md\n## Inbox\n<!-- code comment -->\n```\n`<!-- inline code -->`\n## Inbox\nPRIVATE\n## Thoughts\n<!-- private\n## Review\ncomment -->\nActual thought'
    ),
    load
  )
  assert.match(note.fields.log, /## Inbox\n<!-- code comment -->/)
  assert.match(note.fields.log, /`<!-- inline code -->`/)
  assert.equal(note.fields.thoughts, 'Actual thought')
  assert.equal(note.fields.review, '')
})

test('setext section boundaries also exclude Inbox and unknown sections', () => {
  const note = parseJournal(
    file,
    raw('Log\n---\nPublic log\n\nInbox\n---\nPRIVATE\n\nThoughts\n---\nPublic thought'),
    load
  )
  assert.equal(note.fields.log, 'Public log')
  assert.equal(note.fields.thoughts, 'Public thought')
  assert.doesNotMatch(JSON.stringify(note.fields), /PRIVATE/)
})

test('new template and empty review subsections are skipped without any API calls', async () => {
  const template = fs.readFileSync(path.join(__dirname, '../templates/journal-entry.md'), 'utf8')
  const noteRaw = raw(template.slice(template.indexOf('## Log')))
  const { app } = fixture(noteRaw)
  const plan = await buildPlan(app, load, [file])
  assert.equal(plan.notes.length, 0)
  assert.deepEqual(plan.skipped, [file.path])
  await syncPlan(
    plan,
    {
      request: () => {
        throw new Error('No network allowed')
      }
    },
    {},
    'publish'
  )
})

test('invalid dates, moved scope, renamed IDs and duplicate IDs fail before publishing', async () => {
  assert.throws(
    () => parseJournal(file, raw('## Log\ntext').replace('2026-09-13\ntags', '2026-02-30\ntags'), load),
    /real YYYY-MM-DD/
  )
  assert.throws(
    () => parseJournal({ ...file, path: '05-Areas/Journal/Reviews/week.md' }, raw('## Log\ntext'), load),
    /Select/
  )
  assert.throws(
    () => parseJournal(file, raw('## Log\ntext', 'contentful_note_id: 20260101000000\n'), load),
    /synced id changed/
  )
  const { app, contents } = fixture(raw('## Log\ntext'))
  const other = { ...file, path: ROOT + 'other.md' }
  contents[other.path] = contents[file.path]
  app.vault.getMarkdownFiles = () => [file, other]
  await assert.rejects(buildPlan(app, load, [file]), /Duplicate Journal id/)
})

test('only selected sections resolve links; published Permanent cards are read, never modified', async () => {
  const { app } = fixture(
    raw(
      '## Log\n[[card|My card]] [web](https://example.com) ![photo](https://example.com/photo.png)\n## Inbox\n![[private.png]] [[secret]]'
    )
  )
  const plan = await buildPlan(app, load, [file])
  assert.deepEqual(plan.notes[0].fields.linkedNoteIds, [cardId])
  assert.match(plan.notes[0].fields.log, new RegExp(`/cards/${cardId}`))
  const client = fakeClient()
  await syncPlan(plan, client, { locale: 'en-US' }, 'publish')
  assert.ok(client.calls.filter((c) => c.method === 'PUT').every((c) => c.target.startsWith('/entries/journalEntry_')))
  assert.doesNotMatch(JSON.stringify(client.calls), /private.png|secret/)
  const unpublished = fakeClient({ cardPublished: false })
  await assert.rejects(syncPlan(plan, unpublished, { locale: 'en-US' }, 'publish'), /Publish Permanent card/)
  assert.equal(unpublished.calls.filter((c) => c.method === 'PUT').length, 0)
})

test('local images are rejected; local ordinary links degrade to text with a warning', async () => {
  const { app } = fixture(raw('## Log\n[[private|label]]'))
  const plan = await buildPlan(app, load, [file])
  assert.equal(plan.notes[0].fields.log, 'label')
  assert.equal(plan.warnings.length, 1)
  await assert.rejects(buildPlan(fixture(raw('## Thoughts\n![[image.png]]')).app, load, [file]), /upload local images/)
})

test('updates reuse the same entry, replace tags, clear removed sections and preserve other locales', async () => {
  const { app, contents } = fixture(raw('## Log\nFirst\n## Thoughts\nOld thought\n## Review\nOld review'))
  const client = fakeClient(),
    config = { locale: 'en-US' }
  let plan = await buildPlan(app, load, [file])
  await syncPlan(plan, client, config, 'publish')
  const target = `/entries/journalEntry_${id}`
  client.entries[target].fields.title['fr-FR'] = 'Titre'
  contents[file.path] = raw('## Log\nEdited\n## Review\nNew review').replace('[life, code]', '[code]')
  plan = await buildPlan(app, load, [file])
  await syncPlan(plan, client, config, 'publish')
  assert.equal(Object.keys(client.entries).length, 1)
  assert.equal(client.entries[target].fields.log['en-US'], 'Edited')
  assert.equal(client.entries[target].fields.thoughts['en-US'], '')
  assert.deepEqual(client.entries[target].fields.tags['en-US'], ['code'])
  assert.equal(client.entries[target].fields.title['fr-FR'], 'Titre')
  client.calls.length = 0
  await syncPlan(plan, client, config, 'publish')
  assert.equal(client.calls.filter((c) => c.method === 'PUT').length, 0)
})

test('preview never publishes; failure reports progress and rerun resumes', async () => {
  const plan = await buildPlan(fixture(raw('## Log\nPublic')).app, load, [file])
  const preview = fakeClient()
  assert.deepEqual((await syncPlan(plan, preview, { locale: 'en-US' }, 'preview')).published, [])
  assert.ok(preview.calls.every((c) => !c.target.endsWith('/published')))
  let fail = true
  const client = fakeClient({ fail: (_, target) => fail && target.endsWith('/published') })
  await assert.rejects(
    syncPlan(plan, client, { locale: 'en-US' }, 'publish'),
    (error) => error.result.synced[0] === id && error.result.published.length === 0
  )
  fail = false
  assert.deepEqual((await syncPlan(plan, client, { locale: 'en-US' }, 'publish')).published, [id])
})

test('model setup targets journalEntry only and stops on incompatible models', async () => {
  const calls = []
  await setup({
    request: async (method, target) => {
      calls.push(target)
      return method === 'GET' ? null : { sys: { version: 1 } }
    }
  })
  assert.deepEqual(calls, [
    '/content_types/journalEntry',
    '/content_types/journalEntry',
    '/content_types/journalEntry/published'
  ])
  await assert.rejects(
    setup({ request: async () => ({ fields: [{ id: 'log', type: 'RichText' }] }) }),
    /Manual model migration/
  )
})

test('CMA retries 429, uses journalEntry header, stops on conflict; refresh identifies Journal', async () => {
  let calls = 0
  const client = createClient(
    { cmaBaseUrl: 'https://api.contentful.com', spaceId: 's', environmentId: 'master', managementToken: 'test' },
    async (_, request) => {
      assert.equal(request.headers['X-Contentful-Content-Type'], 'journalEntry')
      assert.equal(request.headers['X-Contentful-Version'], '4')
      return ++calls === 1 ? new Response('', { status: 429 }) : Response.json({})
    },
    async () => {}
  )
  await client.request('PUT', '/entries/journalEntry_test', {}, 4)
  assert.equal(calls, 2)
  await revalidate({ revalidateUrl: 'https://example.com/api/revalidate' }, { published: [id] }, async (_, request) => {
    assert.equal(JSON.parse(request.body).contentTypeId, 'journalEntry')
    return Response.json({ revalidated: true })
  })
})

test('actual QuickAdd module preserves private/local body while writing sync metadata', async (t) => {
  const { app, contents } = fixture(raw('## Log\nPublic\n## Inbox\nPRIVATE'))
  const client = fakeClient()
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    if (url === 'https://example.com/api/revalidate') return Response.json({ revalidated: true })
    const result = await client.request(
      request.method,
      new URL(url).pathname.replace('/spaces/s/environments/master', ''),
      request.body && JSON.parse(request.body),
      request.headers['X-Contentful-Version'] === undefined
        ? undefined
        : Number(request.headers['X-Contentful-Version'])
    )
    return result ? Response.json(result) : new Response('', { status: 404 })
  })
  const result = await require('../quickadd/journal-publish.js').entry(
    { app, obsidian: { parseYaml: load, Notice: class {} } },
    {
      spaceId: 's',
      environmentId: 'master',
      locale: 'en-US',
      managementToken: 'test',
      revalidateUrl: 'https://example.com/api/revalidate',
      revalidateSecret: 'test'
    }
  )
  assert.deepEqual(result.published, [id])
  assert.match(contents[file.path], /contentful_last_mode: published/)
  assert.match(contents[file.path], /## Inbox\nPRIVATE/)
  assert.doesNotMatch(JSON.stringify(client.calls), /PRIVATE/)
  assert.ok(createQuickAddModule('check').entry)
})
