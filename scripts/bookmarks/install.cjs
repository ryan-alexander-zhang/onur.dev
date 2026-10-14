const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { randomUUID } = require('node:crypto')
const { createQuickAddModule } = require('./lib.cjs')

function install(vaultPath, apply = false) {
  const vault = fs.realpathSync(vaultPath)
  const configPath = path.join(vault, '.obsidian/plugins/quickadd/data.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const folder = '99-Meta/Scripts/bookmarks-contentful'
  const modes = ['check', 'preview', 'publish']
  const flatten = (choices) => choices.flatMap((c) => [c, ...flatten(c.choices || [])])
  const allChoices = flatten(config.choices)
  const source =
    allChoices.find((c) =>
      c.macro?.commands?.some((s) => s.type === 'UserScript' && s.path?.endsWith('/permanent-publish.js'))
    ) ||
    allChoices.find((c) =>
      c.macro?.commands?.some((s) => s.type === 'UserScript' && s.path?.endsWith('/contentful-publish-current-note.js'))
    )
  const connection = source?.macro?.commands.find((c) => c.type === 'UserScript')?.settings || {}
  for (const mode of modes) {
    const { settings } = createQuickAddModule(mode)
    const name = settings.name,
      scriptPath = `${folder}/bookmarks-${mode}.js`
    const existing = allChoices.find((c) => c.name === name)
    if (existing) {
      if (existing.macro?.commands?.length !== 1 || existing.macro.commands[0].path !== scriptPath)
        throw new Error(`Choice collision: ${name}`)
      continue
    }
    const values = Object.fromEntries(
      Object.entries(settings.options).map(([key, option]) => [key, connection[key] ?? option.defaultValue])
    )
    config.choices.push({
      id: randomUUID(),
      name,
      type: 'Macro',
      command: true,
      runOnStartup: false,
      macro: {
        id: randomUUID(),
        name,
        commands: [
          { id: randomUUID(), name: `bookmarks-${mode}`, type: 'UserScript', path: scriptPath, settings: values }
        ]
      }
    })
  }
  const sources = modes.map((mode) => [`quickadd/bookmarks-${mode}.js`, `${folder}/bookmarks-${mode}.js`])
  sources.push(['README.md', `${folder}/README.md`], ['schema.json', `${folder}/schema.json`])
  const writes = sources.map(([source, target]) => ({
    path: path.join(vault, target),
    content: fs.readFileSync(path.join(__dirname, source), 'utf8')
  }))
  const yaml = require('js-yaml')
  const basePath = path.join(vault, 'Bookmarks.base')
  const base = yaml.load(fs.readFileSync(basePath, 'utf8'))
  for (const view of base.views) {
    view.order ||= []
    for (const key of ['description', 'cover']) if (!view.order.includes(key)) view.order.push(key)
  }
  if (!base.views.some((view) => view.name === '网站'))
    base.views.push({
      type: 'cards',
      name: '网站',
      filters: {
        and: [
          'file.folder == \"06-Resources/Web/Bookmarks\"',
          'type == \"bookmark\"',
          'bookmark_status != \"retired\"',
          'source.startsWith(\"https://\") || source.startsWith(\"http://\")'
        ]
      },
      groupBy: { property: 'bookmark_group', direction: 'ASC' },
      order: ['file.name', 'description', 'bookmark_group', 'tags', 'source', 'cover', 'created'],
      sort: [
        { property: 'created', direction: 'DESC' },
        { property: 'id', direction: 'DESC' }
      ],
      image: 'note.cover',
      imageFit: 'cover',
      imageAspectRatio: 1.905,
      cardSize: 280
    })
  writes.push({ path: basePath, content: yaml.dump(base, { lineWidth: -1, noRefs: true }) })
  const templatePath = path.join(vault, '99-Meta/Templates/bookmark.md')
  let template = fs.readFileSync(templatePath, 'utf8')
  for (const key of ['description', 'cover'])
    if (!new RegExp('^' + key + ':', 'm').test(template))
      template = template.replace('bookmark_status:', key + ':\nbookmark_status:')
  writes.push({ path: templatePath, content: template })
  writes.push({ path: configPath, content: JSON.stringify(config, null, 2) + '\n' })
  const changed = writes.filter((w) => !fs.existsSync(w.path) || fs.readFileSync(w.path, 'utf8') !== w.content)
  if (apply && changed.length) {
    const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmarks-publisher-backup-'))
    for (const file of changed) {
      if (fs.existsSync(file.path)) {
        const target = path.join(backup, path.relative(vault, file.path))
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.copyFileSync(file.path, target)
      }
      fs.mkdirSync(path.dirname(file.path), { recursive: true })
      fs.writeFileSync(file.path, file.content)
    }
    console.info(`Backup: ${backup}`)
  }
  return changed.map((w) => path.relative(vault, w.path))
}
if (require.main === module) {
  if (!process.argv[2] || process.argv[2].startsWith('--'))
    throw new Error('Usage: node scripts/bookmarks/install.cjs /absolute/vault/path [--apply]')
  console.info(
    JSON.stringify(
      { apply: process.argv.includes('--apply'), files: install(process.argv[2], process.argv.includes('--apply')) },
      null,
      2
    )
  )
}
module.exports = { install }
