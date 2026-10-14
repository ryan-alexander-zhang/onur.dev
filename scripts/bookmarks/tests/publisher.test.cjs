const { test } = require('node:test')
const assert = require('node:assert/strict')
const yaml = require('js-yaml')
const { parseBookmark, buildPlan, syncPlan, schema, localCover } = require('../lib.cjs')
const parseYaml = (text) => yaml.load(text, { schema: yaml.CORE_SCHEMA })
const file = { path: '06-Resources/Web/Bookmarks/Example.md', extension: 'md', basename: 'Example' }
const note = (id = '20260101080000', extra = '') =>
  `---\nid: ${id}\ncreated: 2026-01-01 08:00:00\ntype: bookmark\nsource: https://example.com/\nbookmark_status: saved\nbookmark_group: AI\ntags: [ai, tool]\n${extra}---\n# Example\n\n## 为什么收藏\nPRIVATE\n## 内容摘要\n\nUseful **summary**.\n\n## 相关笔记\n[[PRIVATE LINK]]\n`
const base = { path: 'Bookmarks.base' }
const baseRaw =
  'views:\n  - name: 网站\n    type: cards\n    sort:\n      - property: created\n        direction: DESC\n'
const app = {
  vault: {
    getAbstractFileByPath: (p) => (p === base.path ? base : p === file.path ? file : null),
    read: async (f) => (f === base ? baseRaw : note())
  }
}
test('extract only public fields, keep H1 and vault date, exclude private body', () => {
  const item = parseBookmark(file, note(), parseYaml)
  assert.equal(item.title, 'Example')
  assert.deepEqual(item.tags, ['ai', 'tool'])
  assert.equal(Object.hasOwn(item, 'kind'), false)
  assert.equal(item.description, 'Useful summary.')
  assert.equal(item.created, '2026-01-01T00:00:00.000Z')
  assert.doesNotMatch(JSON.stringify(item), /PRIVATE|Example.md/)
  assert.throws(() => parseBookmark({ ...file, path: '01-Inbox/Example.md' }, note(), parseYaml), /directly under/)
  assert.throws(() => parseBookmark(file, note().replace('saved', 'retired'), parseYaml), /publishable/)
  assert.throws(
    () => parseBookmark(file, note().replace('https://example.com/', 'javascript:alert(1)'), parseYaml),
    /HTTP/
  )
})
test('Base query controls membership and order; duplicate IDs and missing sources fail', async () => {
  const plan = await buildPlan(app, parseYaml, {}, async () => [file.path])
  assert.equal(plan.snapshot.items.length, 1)
  assert.deepEqual(plan.snapshot.groups, [{ id: 'ai', slug: 'ai', title: 'AI' }])
  await assert.rejects(
    buildPlan(app, parseYaml, {}, async () => [file.path, file.path]),
    /Duplicate bookmark id/
  )
  await assert.rejects(
    buildPlan(app, parseYaml, {}, async () => ['missing']),
    /no longer exists/
  )
})
function remote(current = null) {
  const calls = []
  return {
    calls,
    request: async (method, path, body, version) => {
      calls.push({ method, path, body, version })
      if (path.startsWith('/content_types/')) return { sys: { publishedVersion: 1 }, fields: schema.fields }
      if (path === '/locales') return { items: [{ code: 'en-US', default: true }] }
      if (method === 'GET') return current
      if (path.endsWith('/published')) return { sys: { version: 3, publishedVersion: 2 } }
      return { sys: { version: 1 }, fields: body.fields }
    }
  }
}
const config = { locale: 'en-US' }
test('one complete entry; preview stays draft, publish swaps entire snapshot, unchanged skips PUT', async () => {
  const plan = await buildPlan(app, parseYaml, {}, async () => [file.path])
  const client = remote()
  await syncPlan(plan, client, config, 'preview')
  assert.equal(client.calls.filter((c) => c.method === 'PUT').length, 1)
  assert.equal(client.calls.at(-1).path, '/entries/bookmarkCatalog_main')
  assert.equal(client.calls.at(-1).body.fields.snapshot['en-US'].items.length, 1)
  const current = {
    sys: { version: 3, publishedVersion: 2, contentType: { sys: { id: 'bookmarkCatalog' } } },
    fields: { snapshot: { 'en-US': plan.snapshot } }
  }
  const same = remote(current)
  const result = await syncPlan(plan, same, config, 'publish')
  assert.equal(result.unchanged, true)
  assert.equal(same.calls.filter((c) => c.method === 'PUT').length, 0)
  const changed = remote({
    ...current,
    fields: { snapshot: { 'en-US': { ...plan.snapshot, groups: [{ slug: 'old' }], items: [] } } }
  })
  const changeResult = await syncPlan(plan, changed, config, 'publish')
  assert.deepEqual(changeResult.slugs.sort(), ['ai', 'old'])
  assert.equal(changed.calls.filter((c) => c.method === 'PUT').length, 2)
  assert.ok(changed.calls.at(-1).path.endsWith('/published'))
})
test('incomplete export, oversized payload, source edits and identity collision cannot publish', async () => {
  const plan = await buildPlan(app, parseYaml, {}, async () => [file.path])
  await assert.rejects(
    syncPlan({ ...plan, snapshot: { ...plan.snapshot, items: [] } }, remote(), config, 'publish'),
    /Empty catalog/
  )
  const big = structuredClone(plan)
  big.snapshot.items[0].description = '字'.repeat(400000)
  await assert.rejects(syncPlan(big, remote(), config, 'publish'), /safe request size/)
  const conflict = remote({ sys: { contentType: { sys: { id: 'post' } } } })
  await assert.rejects(syncPlan(plan, conflict, config, 'publish'), /identity mismatch/)
  const edited = remote()
  await assert.rejects(
    syncPlan(
      plan,
      edited,
      config,
      'publish',
      async (c) => c,
      async () => {
        throw Error('source changed')
      }
    ),
    /source changed/
  )
  assert.equal(edited.calls.filter((c) => c.method === 'PUT').length, 0)
})
test('local cover rejects arbitrary private files; remote cover requires http(s)', async () => {
  const a = { metadataCache: { getFirstLinkpathDest: () => ({ path: '05-Areas/private.md' }) } }
  await assert.rejects(localCover(a, 'private.md', { file }, {}, config), /Attachments/)
  assert.equal(
    await localCover(a, 'https://example.com/cover.png', { file }, {}, config),
    'https://example.com/cover.png'
  )
})

test('Base query targets the unique vault ID and verifies the resolved path before querying', async () => {
  const { queryBase } = require('../lib.cjs')
  const app = { appId: 'abcd1234', vault: { adapter: { basePath: '/correct/vault' }, getName: () => 'duplicate-name' } }
  const commands = []
  const run = async (_, args) => {
    commands.push(args)
    assert.equal(args[0], 'vault=abcd1234')
    return { stdout: args[1] === 'vault' ? '/correct/vault\n' : '[{"path":"note.md"}]' }
  }
  assert.deepEqual(await queryBase(app, 'Bookmarks.base', '网站', run), ['note.md'])
  assert.equal(commands.length, 2)
  await assert.rejects(
    queryBase(app, 'Bookmarks.base', '网站', async () => ({ stdout: '/wrong/vault' })),
    /different vault/
  )
})
