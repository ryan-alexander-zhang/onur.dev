const fs = require('node:fs')
const path = require('node:path')
const { load } = require('js-yaml')
const { ROOT, buildPlan } = require('./lib.cjs')
const vault = process.argv[2]
if (!vault) throw new Error('Usage: node scripts/journal/check-vault.cjs /absolute/vault/path')
const files = fs
  .readdirSync(path.join(vault, ROOT))
  .filter((name) => name.endsWith('.md'))
  .map((name) => ({ path: ROOT + name, basename: name.slice(0, -3), extension: 'md' }))
const permanentRoot = '02-Zettelkasten/Permanent/'
const permanent = fs
  .readdirSync(path.join(vault, permanentRoot))
  .filter((n) => n.endsWith('.md'))
  .map((n) => ({ path: permanentRoot + n, basename: n.slice(0, -3) }))
const app = {
  vault: { getMarkdownFiles: () => files, read: async (file) => fs.readFileSync(path.join(vault, file.path), 'utf8') },
  metadataCache: {
    getFirstLinkpathDest: (target) => permanent.find((f) => f.basename === target || f.path === target + '.md'),
    getFileCache: (file) => ({
      frontmatter: load(fs.readFileSync(path.join(vault, file.path), 'utf8').match(/^---\n([^]*?)\n---/)[1])
    })
  }
}
buildPlan(app, load, files)
  .then((plan) =>
    console.info(JSON.stringify({ ready: plan.notes.length, skipped: plan.skipped, warnings: plan.warnings }, null, 2))
  )
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
