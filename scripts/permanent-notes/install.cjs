// Reproducible installation; --apply is explicit because the vault is outside this repo.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const os = require('node:os')
const { createQuickAddModule } = require('./lib.cjs')

function install(vaultPath, apply = false) {
  const vault = fs.realpathSync(vaultPath)
  const configPath = path.join(vault, '.obsidian/plugins/quickadd/data.json')
  const original = fs.readFileSync(configPath, 'utf8')
  const config = JSON.parse(original)
  const folder = '99-Meta/Scripts/permanent-contentful'
  const modes = ['check', 'preview', 'publish', 'all']
  const connection =
    config.choices
      .find((c) => c.name === 'Contentful Publish Current Note')
      ?.macro?.commands.find((c) => c.type === 'UserScript')?.settings || {}
  for (const mode of modes) {
    const { settings } = createQuickAddModule(mode)
    const name = settings.name
    const scriptPath = `${folder}/permanent-${mode}.js`
    const existing = config.choices.find((c) => c.name === name)
    if (existing) {
      if (existing.macro?.commands?.length !== 1 || existing.macro.commands[0].path !== scriptPath)
        throw new Error(`Existing choice has a different implementation: ${name}`)
      continue
    }
    const values = Object.fromEntries(
      Object.entries(settings.options).map(([key, option]) => [key, connection[key] ?? option.defaultValue])
    )
    config.choices.push({
      id: crypto.randomUUID(),
      name,
      type: 'Macro',
      command: true,
      runOnStartup: false,
      macro: {
        id: crypto.randomUUID(),
        name,
        commands: [
          { id: crypto.randomUUID(), name: `permanent-${mode}`, type: 'UserScript', path: scriptPath, settings: values }
        ]
      }
    })
  }
  const files = modes.map((mode) => [`quickadd/permanent-${mode}.js`, `${folder}/permanent-${mode}.js`])
  files.push(['permanent-note.md', '99-Meta/Templates/permanent-note.md'], ['README.md', `${folder}/README.md`])
  const writes = files.map(([source, target]) => ({
    path: path.join(vault, target),
    content: fs.readFileSync(path.join(__dirname, source), 'utf8')
  }))
  writes.push({ path: configPath, content: JSON.stringify(config, null, 2) + '\n' })
  const changed = writes.filter((w) => !fs.existsSync(w.path) || fs.readFileSync(w.path, 'utf8') !== w.content)
  if (apply) {
    const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'permanent-publisher-backup-'))
    for (const file of changed) {
      if (fs.existsSync(file.path)) {
        const target = path.join(backup, path.relative(vault, file.path))
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.copyFileSync(file.path, target)
      }
      fs.mkdirSync(path.dirname(file.path), { recursive: true })
      fs.writeFileSync(file.path, file.content)
    }
    if (changed.length) console.info(`Backup: ${backup}`)
  }
  return changed.map((w) => path.relative(vault, w.path))
}

if (require.main === module) {
  const vault = process.argv[2]
  if (!vault || vault.startsWith('--')) throw new Error('Usage: node install.cjs /absolute/vault/path [--apply]')
  console.info(
    JSON.stringify(
      { apply: process.argv.includes('--apply'), files: install(vault, process.argv.includes('--apply')) },
      null,
      2
    )
  )
}
module.exports = { install }
