const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const {
  normalizeNote,
  normalizePermanentLinks,
  splitPermanentSections,
  syncNoteToContentful,
  createQuickAddModule,
  triggerRevalidation
} = require('../quickadd/contentful-sync-lib.js')
const current = { path: 'Permanent/current.md', basename: 'current', extension: 'md' }
const id = '20260625165618'
const otherId = '20260625170000'
const fm = { type: 'permanent-note', id: Number(id), aliases: ['English alias'], tags: ['distributed-system'] }
function metadata() {
  const files = {
    'Permanent/other.md': { type: 'permanent-note', id: Number(otherId), aliases: ['English Target'] },
    'Permanent/current.md': fm,
    'Source/book.md': { type: 'literature-note' }
  }
  return {
    vault: { getAbstractFileByPath: (p) => ({ path: p }) },
    metadataCache: {
      getFirstLinkpathDest: (target) => {
        const p = Object.keys(files).find(
          (p) => p.replace(/\.md$/, '') === target || path.basename(p, '.md') === target
        )
        return p ? { path: p } : null
      },
      getFileCache: (file) => ({ frontmatter: files[file.path] }),
      getCachedFiles: () => Object.keys(files),
      getCache: (p) => ({ frontmatter: files[p] })
    }
  }
}
function note(
  body = '# 标题\n\n中文 [[other|中文显示]]\n\n## English\nEnglish [[English Target|English display]]\n\n## 来源\n[[book|书籍]]'
) {
  return normalizeNote(current, body, fm, 'en-US')
}
test('real demo preserves Chinese, English and sources separately, without guessing titleEn', () => {
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures/permanent-note-demo.md'), 'utf8')
  const result = normalizeNote(current, raw, fm, 'en-US')
  assert.equal(result.noteId, id)
  assert.equal(result.entryId, `permanentNote_${id}`)
  assert.equal(result.title, '分布式系统中的强一致性往往要牺牲可用性或低延迟')
  assert.match(result.bodyZh, /Atomic Consistency/)
  assert.doesNotMatch(result.bodyZh, /## English|## 来源/)
  assert.match(result.bodyEn, /^Strong consistency/)
  assert.match(result.sources, /https:\/\/www.cs.umd.edu/)
  assert.equal(result.titleEn, '')
  assert.equal(normalizePermanentLinks(result.bodyZh, metadata(), current, id).linkedNoteIds.length, 0)
})
test('EN alias and local markdown links resolve; sources, self, literals and images create no edges', () => {
  const result = normalizePermanentLinks(
    '[[English Target|English display]] [中文](other.md) [[current]] [[missing|Unknown]] [[book|Book]] ![[other|image]] ![image](other.md) `[[other]]`\n```md\n[[other]]\n```\n[web](https://example.com) ',
    metadata(),
    current,
    id
  )
  assert.deepEqual(result.linkedNoteIds, [otherId])
  assert.match(result.markdown, new RegExp(`\\[English display\\]\\(/cards/${otherId}\\)`))
  assert.match(result.markdown, /Unknown Book image image `\[\[other\]\]`/)
  assert.match(result.markdown, /\[web\]\(https:\/\/example.com\)/)
  assert.equal(result.warnings.length, 3)
  assert.deepEqual(normalizePermanentLinks('[[other]]', metadata(), current, id, false).linkedNoteIds, [])
  assert.deepEqual(
    normalizePermanentLinks('`[[other]]`\n    [[other]]\n~~~\n[[other]]\n~~~\n![[other]]', metadata(), current, id)
      .linkedNoteIds,
    []
  )
})
test('code section markers stay literal; IDs survive rename, cycles and reject identity edits', () => {
  const sections = splitPermanentSections('中文\n```\n## English\n```\n## English\nEnglish\n## 来源\nSource')
  assert.match(sections.bodyZh, /## English/)
  assert.equal(sections.bodyEn, 'English')
  assert.equal(normalizeNote({ ...current, path: 'renamed.md' }, '# 改名\n正文', fm, 'en-US').entryId, note().entryId)
  assert.throws(
    () => normalizeNote(current, '# 标题\n正文', { ...fm, contentful_note_id: otherId }, 'en-US'),
    /immutable/
  )
  assert.throws(() => normalizeNote(current, '# 标题\n正文', { ...fm, id: 123 }, 'en-US'), /14-digit/)
  assert.deepEqual(
    normalizePermanentLinks('[[current]]', metadata(), { path: 'Permanent/other.md' }, otherId).linkedNoteIds,
    [id]
  )
})
function mockClient() {
  let entry = null
  const calls = []
  return {
    calls,
    environmentBasePath: '/spaces/test/environments/master',
    async request(method, p, options = {}) {
      calls.push({ method, path: p, ...options })
      if (method === 'GET') return entry
      if (!p.endsWith('/published'))
        entry = { sys: { id: `permanentNote_${id}`, version: 1 }, ...JSON.parse(options.body) }
      return entry
    }
  }
}
for (const mode of ['preview', 'publish'])
  test(`${mode}: only current entry is written; bilingual edge union and no linked entry/assets/SEO`, async () => {
    const client = mockClient()
    const result = await syncNoteToContentful({
      app: metadata(),
      file: current,
      note: note(),
      client,
      mode,
      frontmatter: fm
    })
    const writes = client.calls.filter((c) => c.method === 'PUT')
    assert.equal(writes.length, mode === 'publish' ? 2 : 1)
    assert.ok(client.calls.every((c) => c.path.includes(`/entries/permanentNote_${id}`)))
    assert.deepEqual(result.entry.fields.linkedNoteIds['en-US'], [otherId])
    assert.equal(result.frontmatterUpdates.contentful_note_id, id)
    assert.equal(result.frontmatterUpdates.id, undefined)
    assert.equal(result.entry.fields.titleEn['en-US'], '')
  })
test('existing post/page/logbook normalization and aliases remain supported', () => {
  for (const [type, expected] of [
    ['writing', 'post'],
    ['page', 'page'],
    ['journal', 'logbook']
  ]) {
    const result = normalizeNote(
      current,
      '# Hello\n\nContent',
      { type, title: 'Hello', slug: 'hello', date: '2026-06-25' },
      'en-US'
    )
    assert.equal(result.contentType, expected)
    assert.equal(result.title, 'Hello')
    assert.equal(result.bodyMarkdown.trim(), 'Content')
    assert.ok(result.entryId)
  }
})
test('actual self-contained QuickAdd modules are reproducible and expose entry functions', () => {
  execFileSync(process.execPath, [path.join(__dirname, '../generate-quickadd.cjs'), '--check'])
  assert.equal(typeof require('../quickadd/contentful-publish-current-note.js').entry, 'function')
  assert.equal(typeof require('../quickadd/contentful-sync-preview-current-note.js').entry, 'function')
  assert.equal(typeof createQuickAddModule('publish').entry, 'function')
})
test('revalidation includes permanentNote and noteId', async () => {
  const original = global.fetch
  let body
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body)
    return { ok: true }
  }
  try {
    assert.equal(
      await triggerRevalidation(
        { revalidateUrl: 'https://site.example/api/revalidate', revalidateSecret: 'test' },
        note()
      ),
      true
    )
    assert.deepEqual(body, { contentTypeId: 'permanentNote', noteId: id })
  } finally {
    global.fetch = original
  }
})
test('website-relative card links preserve identity; raw URLs do not create edges', () => {
  const result = normalizePermanentLinks(
    `[Existing](/cards/${otherId}) https://example.com/[[current]]`,
    metadata(),
    current,
    id
  )
  assert.deepEqual(result.linkedNoteIds, [otherId])
  assert.match(result.markdown, /https:\/\/example.com\/\[\[current\]\]/)
})
for (const mode of ['publish', 'preview'])
  test(`actual QuickAdd ${mode} entry reads and modifies current file only`, async () => {
    const app = metadata()
    const reads = [],
      modifications = [],
      requests = []
    app.workspace = { getActiveFile: () => current }
    app.vault.read = async (file) => {
      reads.push(file.path)
      return '# 标题\n\n中文 [[other]]'
    }
    app.vault.modify = async (file, text) => modifications.push({ file, text })
    const original = global.fetch
    let entry
    global.fetch = async (url, options) => {
      requests.push({ url, ...options })
      if (options.method === 'PUT' && !url.endsWith('/published'))
        entry = { sys: { id: `permanentNote_${id}`, version: 1 }, ...JSON.parse(options.body) }
      return { ok: Boolean(entry), status: entry ? 200 : 404, text: async () => JSON.stringify(entry || {}) }
    }
    try {
      const quickAddModule = require(
        mode === 'publish'
          ? '../quickadd/contentful-publish-current-note.js'
          : '../quickadd/contentful-sync-preview-current-note.js'
      )
      await quickAddModule.entry(
        { app, obsidian: { stringifyYaml: JSON.stringify } },
        {
          spaceId: 'test',
          managementToken: 'test',
          showNotice: false,
          revalidateUrl: 'https://site.example/api/revalidate',
          revalidateSecret: 'test'
        }
      )
      assert.deepEqual(reads, [current.path])
      assert.deepEqual(
        modifications.map((m) => m.file.path),
        [current.path]
      )
      assert.match(modifications[0].text, /"id":20260625165618/)
      assert.ok(
        requests.filter((r) => r.method !== 'POST').every((r) => r.url.includes(`/entries/permanentNote_${id}`))
      )
      assert.equal(requests.filter((r) => r.url.endsWith('/published')).length, mode === 'publish' ? 1 : 0)
    } finally {
      global.fetch = original
    }
  })
test('targeted model dry run is credential-free and returns exact permanentNote schema', () => {
  const script = path.join(__dirname, '../../setup-contentful-model.sh')
  const model = JSON.parse(
    execFileSync('bash', [script, '--only', 'permanentNote', '--dry-run'], {
      env: { PATH: process.env.PATH },
      encoding: 'utf8'
    })
  )
  assert.equal(model.name, 'Permanent Note')
  assert.equal(model.fields.length, 9)
  assert.deepEqual(model.fields.find((f) => f.id === 'noteId').validations[0], { unique: true })
  assert.equal(model.fields.find((f) => f.id === 'bodyZh').type, 'Text')
  assert.equal(model.fields.find((f) => f.id === 'bodyZh').required, true)
})
test('targeted model setup only requests permanentNote, including publish', () => {
  const os = require('node:os')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'permanent-model-test-'))
  try {
    const log = path.join(directory, 'requests.jsonl')
    fs.writeFileSync(
      path.join(directory, 'curl'),
      `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
const url = args.at(-1)
fs.appendFileSync(process.env.MODEL_TEST_LOG, JSON.stringify({url, args}) + '\\n')
const output = args[args.indexOf('-o') + 1]
const exists = args.includes('-X')
fs.writeFileSync(output, exists ? '{"sys":{"version":1}}' : '{}')
process.stdout.write(exists ? '200' : '404')
`,
      { mode: 0o755 }
    )
    execFileSync('bash', [path.join(__dirname, '../../setup-contentful-model.sh'), '--only', 'permanentNote'], {
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        MODEL_TEST_LOG: log,
        CONTENTFUL_SPACE_ID: 'test',
        CONTENTFUL_MANAGEMENT_TOKEN: 'test'
      }
    })
    const requests = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(requests.length, 3)
    assert.ok(requests.every((r) => /\/content_types\/permanentNote(?:\/published)?$/.test(r.url)))
    const payload = requests[1].args[requests[1].args.indexOf('--data') + 1]
    assert.equal(JSON.parse(payload).name, 'Permanent Note')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
