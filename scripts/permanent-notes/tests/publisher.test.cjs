const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('js-yaml')
const schema = require('../schema.json')
const {
  ROOT,
  parseNote,
  buildPlan,
  syncPlan,
  createClient,
  readSettings,
  revalidate,
  createQuickAddModule
} = require('../lib.cjs')
const { setup } = require('../setup.cjs')

const a = '20260908000001'
const b = '20260908000002'
const c = '20260908000003'
function raw(id, body = '中文', extra = '') {
  return `---\nid: ${id}\ntype: permanent-note\nenglish_title: English title\n${extra}---\n# 中文标题\n\n${body}\n\n## English\nEnglish body\n\n## 来源\n[[Literature|文献]]\n[web](https://example.com/source)`
}
function fixture(contents) {
  const files = Object.keys(contents).map((name) => ({ path: ROOT + name + '.md', basename: name, extension: 'md' }))
  return {
    files,
    app: {
      vault: { getMarkdownFiles: () => files, read: async (file) => contents[file.basename] },
      metadataCache: {
        getFirstLinkpathDest: (target) => files.find((f) => f.basename === target || f.path === target + '.md')
      },
      workspace: { getActiveFile: () => files[0] }
    }
  }
}
function fakeClient({ fail, seed = {} } = {}) {
  const entries = structuredClone(seed)
  const calls = []
  let version = 0
  return {
    entries,
    calls,
    async request(method, path, body, expectedVersion) {
      calls.push({ method, path, body, expectedVersion })
      if (fail?.(method, path, body)) throw new Error('Simulated failure')
      if (path === '/content_types/permanentNote' && method === 'GET')
        return { ...schema, sys: { publishedVersion: 1 } }
      if (path === '/locales') return { items: [{ code: 'en-US' }] }
      const key = path.replace(/\/published$/, '')
      if (method === 'GET') return structuredClone(entries[key] || null)
      if (entries[key]) assert.equal(expectedVersion, entries[key].sys.version)
      if (path.endsWith('/published')) {
        const entry = entries[key]
        entry.sys.publishedVersion = entry.sys.version
        entry.sys.version++
      } else {
        const prev = entries[key]
        entries[key] = {
          fields: body.fields,
          sys: {
            ...prev?.sys,
            id: key.split('/').pop(),
            version: prev ? prev.sys.version + 1 : ++version,
            contentType: { sys: { id: 'permanentNote' } }
          }
        }
      }
      return structuredClone(entries[key])
    }
  }
}
const config = { locale: 'en-US' }

test('matches current bilingual format; missing English title stays empty; code headings stay literal', () => {
  const file = { path: ROOT + 'A.md' }
  const note = parseNote(file, raw(a, '正文\n```md\n## English\n[[missing]]\n```'), load)
  assert.equal(note.titleEn, 'English title')
  assert.match(note.bodyZh, /## English/)
  assert.equal(note.bodyEn, 'English body')
  assert.match(note.sources, /文献/)
  assert.equal(parseNote(file, raw(a).replace('english_title: English title\n', ''), load).titleEn, '')
  assert.throws(() => parseNote(file, raw(a, '正文', `contentful_note_id: ${b}\n`), load), /synced ID changed/)
})

test('cycles, aliases and sources form finite dependency closure; exclude unrelated notes and source edges', async () => {
  const { app, files } = fixture({
    A: raw(a, '[[B|B中文]] [[B|B again]] [[A]]'),
    B: raw(b, '[[A]]', 'aliases: [English B]\n').replace('[[Literature|文献]]', '[[C|C source]]'),
    C: raw(c),
    unrelated: raw('20260908000004', '[[missing]]')
  })
  const plan = await buildPlan(app, load, [files[0]])
  assert.deepEqual(
    plan.notes.map((n) => n.id),
    [c, b, a]
  )
  assert.deepEqual(plan.notes.at(-1).fields.linkedNoteIds, [b])
  assert.deepEqual(plan.notes[1].fields.linkedNoteIds, [a])
  assert.deepEqual(plan.notes[1].dependencies, [a, c])
  assert.match(plan.notes.at(-1).fields.bodyZh, new RegExp(`B中文\\]\\(/cards/${b}`))
})

test('literal code, comments and images do not make graph edges; Markdown links and aliases do', async () => {
  const { app, files } = fixture({
    A: raw(
      a,
      '[[English B|display]] [B](B.md) [B2](<B.md>)\n`[[missing]]`\n~~~\n[[missing]]\n~~~\n<!-- [[missing]] -->\n![photo](https://example.com/photo.png)\n[web](https://example.com/a(b))\n[x][ref]\n[ref]: B.md'
    ),
    B: raw(b, '中文', 'aliases: [English B]\n')
  })
  const plan = await buildPlan(app, load, [files[0]])
  const note = plan.notes.at(-1)
  assert.deepEqual(note.fields.linkedNoteIds, [b])
  assert.match(note.fields.bodyZh, /`\[\[missing\]\]`/)
  assert.match(note.fields.bodyZh, /!\[photo\]\(https:\/\/example.com\/photo.png\)/)
  assert.match(note.fields.bodyZh, new RegExp(`\\[ref\\]: /cards/${b}`))
})

test('preflight rejects missing links, duplicate IDs, local embeds and conflicting aliases', async () => {
  for (const [contents, pattern] of [
    [{ A: raw(a, '[[missing]]') }, /missing or non-Permanent/],
    [{ A: raw(a), B: raw(a) }, /Duplicate note ID/],
    [{ A: raw(a, '![[photo.png]]') }, /upload local image/],
    [
      { A: raw(a, '[[alias]]'), B: raw(b, '中文', 'aliases: [alias]\n'), C: raw(c, '中文', 'aliases: [alias]\n') },
      /ambiguous link/
    ]
  ]) {
    const { app, files } = fixture(contents)
    await assert.rejects(buildPlan(app, load, [files[0]]), pattern)
  }
})

test('all drafts precede dependency-first publication; reruns skip unchanged published entries', async () => {
  const { app, files } = fixture({ A: raw(a, '[[B]]'), B: raw(b, '[[A]]') })
  const plan = await buildPlan(app, load, [files[0]])
  const client = fakeClient()
  const states = []
  const result = await syncPlan(plan, client, config, 'publish', async (n, state) => states.push([n.id, state]))
  assert.deepEqual(result.published, [b, a])
  const mutations = client.calls.filter((c) => c.method === 'PUT')
  assert.deepEqual(
    mutations.map((c) => c.path.endsWith('/published')),
    [false, false, true, true]
  )
  assert.deepEqual(states, [
    [b, 'published'],
    [a, 'published']
  ])
  client.calls.length = 0
  await syncPlan(plan, client, config, 'publish')
  assert.equal(client.calls.filter((c) => c.method === 'PUT').length, 0)
})

test('preview writes drafts only, preserves other locales and uses remote versions', async () => {
  const { app, files } = fixture({ A: raw(a) })
  const plan = await buildPlan(app, load, files)
  const client = fakeClient()
  await syncPlan(plan, client, config, 'publish')
  client.entries[`/entries/permanentNote_${a}`].fields.title['de-DE'] = 'Deutsch'
  plan.notes[0].fields.title = '新标题'
  client.calls.length = 0
  const states = []
  const result = await syncPlan(plan, client, config, 'preview', async (_, s) => states.push(s))
  assert.deepEqual(result.published, [])
  assert.deepEqual(states, ['preview'])
  assert.equal(client.entries[`/entries/permanentNote_${a}`].fields.title['de-DE'], 'Deutsch')
  assert.equal(client.calls.filter((c) => c.path.endsWith('/published')).length, 0)
})

test('dependency failure reports partial state, does not publish root; safe rerun resumes', async () => {
  const { app, files } = fixture({ A: raw(a, '[[B]]'), B: raw(b) })
  const plan = await buildPlan(app, load, [files[0]])
  let fail = true
  const client = fakeClient({ fail: (_, path) => fail && path === `/entries/permanentNote_${b}/published` })
  await assert.rejects(syncPlan(plan, client, config, 'publish'), (error) => {
    assert.equal(error.result.synced.length, 2)
    assert.deepEqual(error.result.published, [])
    return /published 0\/2/.test(error.message)
  })
  assert.equal(
    client.calls.some((c) => c.path === `/entries/permanentNote_${a}/published`),
    false
  )
  fail = false
  assert.deepEqual((await syncPlan(plan, client, config, 'publish')).published, [b, a])
})

test('remote identity mismatch aborts entire batch before any writes', async () => {
  const { app, files } = fixture({ A: raw(a, '[[B]]'), B: raw(b) })
  const plan = await buildPlan(app, load, [files[0]])
  const client = fakeClient({
    seed: { [`/entries/permanentNote_${a}`]: { sys: { contentType: { sys: { id: 'post' } } }, fields: {} } }
  })
  await assert.rejects(syncPlan(plan, client, config, 'publish'), /Remote identity mismatch/)
  assert.equal(
    client.calls.some((c) => c.method === 'PUT'),
    false
  )
})

test('CMA honors versions, retries rate limits, and never retries conflicts', async () => {
  const calls = []
  let count = 0
  const client = createClient(
    { cmaBaseUrl: 'https://api.contentful.com', spaceId: 's', environmentId: 'master', managementToken: 'secret' },
    async (url, options) => {
      calls.push({ url, ...options })
      count++
      return count === 1
        ? new Response('', { status: 429, headers: { 'x-contentful-ratelimit-reset': '1' } })
        : Response.json({ sys: { version: 2 } })
    },
    async () => {}
  )
  await client.request('PUT', '/entries/test', { fields: {} }, 1)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].headers['X-Contentful-Version'], '1')
  assert.equal(calls[1].headers['X-Contentful-Content-Type'], 'permanentNote')
  let conflicts = 0
  const conflict = createClient({ cmaBaseUrl: '', spaceId: 's', environmentId: 'e' }, async () => {
    conflicts++
    return new Response('', { status: 409 })
  })
  await assert.rejects(conflict.request('PUT', '/entries/x', {}), /HTTP 409/)
  assert.equal(conflicts, 1)
})

test('read-only QuickAdd check needs no credentials or remote requests', async () => {
  const { app } = fixture({ A: raw(a) })
  const notices = []
  const plan = await createQuickAddModule('check').entry({
    app,
    obsidian: {
      parseYaml: load,
      Notice: class {
        constructor(text) {
          notices.push(text)
        }
      }
    }
  })
  assert.equal(plan.notes.length, 1)
  assert.match(notices[0], /Checked 1 cards/)
})

test('settings and revalidation report incomplete configuration and website failure', async () => {
  assert.throws(
    () =>
      readSettings({ spaceId: 's', managementToken: 'token', revalidateUrl: 'https://example.com/api/revalidate' }, {}),
    /both/
  )
  assert.throws(
    () => readSettings({ spaceId: 's', managementToken: 'token', cmaBaseUrl: 'https://example.com' }, {}),
    /official/
  )
  const config = { revalidateUrl: 'https://example.com/api/revalidate', revalidateSecret: 'secret' }
  assert.equal(
    await revalidate(config, { published: [] }, () => {
      throw new Error('must not fetch')
    }),
    false
  )
  await assert.rejects(
    revalidate(config, { published: [a] }, async () => Response.json({ revalidated: false })),
    /Website refresh failed/
  )
  assert.equal(
    await revalidate(config, { published: [a, b] }, async (_, request) => {
      assert.deepEqual(JSON.parse(request.body), { contentTypeId: 'permanentNote', noteIds: [a, b] })
      return Response.json({ revalidated: true })
    }),
    true
  )
})

test('dedicated setup only creates and activates permanentNote; incompatible models are preserved', async () => {
  const calls = []
  await setup({
    request: async (method, path, body, version) => {
      calls.push({ method, path, body, version })
      return method === 'GET' ? null : { sys: { version: 1 } }
    }
  })
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/content_types/permanentNote', '/content_types/permanentNote', '/content_types/permanentNote/published']
  )
  assert.equal(calls[2].version, 1)
  await assert.rejects(
    setup({ request: async () => ({ fields: [{ id: 'bodyZh', type: 'RichText' }] }) }),
    /manual migration/
  )
})

test('generated QuickAdd publisher updates each local card only after success and refreshes once', async (t) => {
  const { dump } = require('js-yaml')
  const contents = { A: raw(a, '[[B]]'), B: raw(b, '[[A]]') }
  const { app } = fixture(contents)
  const client = fakeClient()
  const localWrites = []
  app.fileManager = {
    processFrontMatter: async (file, callback) => {
      const original = contents[file.basename]
      const frontmatter = original.match(/^---\n([^]*?)\n---\n/)
      const fm = load(frontmatter[1])
      callback(fm)
      localWrites.push(fm)
      contents[file.basename] = `---\n${dump(fm)}---\n${original.slice(frontmatter[0].length)}`
    }
  }
  let refreshes = 0
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    if (url === 'https://example.com/api/revalidate') {
      refreshes++
      return Response.json({ revalidated: true })
    }
    const path = new URL(url).pathname.replace('/spaces/s/environments/master', '')
    const value = await client.request(
      request.method,
      path,
      request.body && JSON.parse(request.body),
      request.headers['X-Contentful-Version'] === undefined
        ? undefined
        : Number(request.headers['X-Contentful-Version'])
    )
    return value ? Response.json(value) : new Response('', { status: 404 })
  })
  const result = await require('../quickadd/permanent-publish.js').entry(
    { app, obsidian: { parseYaml: load, Notice: class {} } },
    {
      spaceId: 's',
      environmentId: 'master',
      managementToken: 'test-token',
      locale: 'en-US',
      revalidateUrl: 'https://example.com/api/revalidate',
      revalidateSecret: 'test-secret'
    }
  )
  assert.deepEqual(result.published, [b, a])
  assert.equal(refreshes, 1)
  assert.equal(localWrites.length, 2)
  assert.ok(localWrites.every((fm) => fm.contentful_last_mode === 'published' && fm.contentful_last_published_at))
  assert.match(contents.A, /# 中文标题\n\n\[\[B\]\]/)
  assert.equal(load(contents.A.match(/^---\n([^]*?)\n---/)[1]).id, Number(a))
})

test('unused reference definitions and escaped links are literal; local reference images are blocked', async () => {
  const { app, files } = fixture({ A: raw(a, '\\[[literal]]\n[unused]: B.md'), B: raw(b) })
  const plan = await buildPlan(app, load, [files[0]])
  assert.equal(plan.notes.length, 1)
  const image = fixture({ A: raw(a, '![photo][ref]\n[ref]: B.md'), B: raw(b) })
  await assert.rejects(buildPlan(image.app, load, [image.files[0]]), /upload local image/)
})
