// Read-only CLI audit using the same planner as QuickAdd. No Contentful credentials required.
const fs = require('node:fs')
const path = require('node:path')
const { load } = require('js-yaml')
const { ROOT, buildPlan } = require('./lib.cjs')

function vaultApp(root) {
  const files = fs
    .readdirSync(path.join(root, ROOT))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ path: ROOT + name, basename: name.slice(0, -3), extension: 'md' }))
  return {
    vault: { getMarkdownFiles: () => files, read: async (file) => fs.readFileSync(path.join(root, file.path), 'utf8') },
    metadataCache: {
      getFirstLinkpathDest: (target, source) =>
        files.find(
          (file) =>
            file.path === target + '.md' ||
            file.path === path.posix.normalize(path.posix.join(path.posix.dirname(source), target + '.md')) ||
            file.basename === target
        )
    }
  }
}

if (require.main === module) {
  const root = process.argv[2]
  if (!root) throw new Error('Usage: node check-vault.cjs /absolute/vault/path')
  const app = vaultApp(root)
  buildPlan(app, load, app.vault.getMarkdownFiles())
    .then((plan) =>
      console.info(
        JSON.stringify(
          {
            count: plan.notes.length,
            edges: plan.notes.reduce((n, note) => n + note.fields.linkedNoteIds.length, 0),
            cards: plan.notes.map((n) => ({ id: n.id, linked: n.fields.linkedNoteIds })),
            warnings: plan.warnings
          },
          null,
          2
        )
      )
    )
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
module.exports = { vaultApp }
