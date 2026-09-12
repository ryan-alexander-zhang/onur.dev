const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { install } = require('../install.cjs')

test('installation preserves blog choices, uses dedicated paths, and is repeatable', (t) => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'permanent-install-test-'))
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }))
  fs.mkdirSync(path.join(vault, '.obsidian/plugins/quickadd'), { recursive: true })
  const configPath = path.join(vault, '.obsidian/plugins/quickadd/data.json')
  const blog = {
    name: 'Contentful Publish Current Note',
    macro: {
      commands: [
        {
          type: 'UserScript',
          path: 'blog.js',
          settings: { spaceId: 's', managementToken: 'env:TEST_TOKEN', uploadBaseUrl: 'unused' }
        }
      ]
    }
  }
  fs.writeFileSync(configPath, JSON.stringify({ choices: [blog], unrelated: { keep: true } }))
  assert.equal(install(vault).length, 7)
  assert.equal(JSON.parse(fs.readFileSync(configPath)).choices.length, 1)
  install(vault, true)
  const config = JSON.parse(fs.readFileSync(configPath))
  assert.deepEqual(config.choices[0], blog)
  assert.deepEqual(config.unrelated, { keep: true })
  assert.equal(config.choices.length, 5)
  const newCommand = config.choices[3].macro.commands[0]
  assert.match(newCommand.path, /permanent-contentful\/permanent-publish.js$/)
  assert.equal(newCommand.settings.managementToken, 'env:TEST_TOKEN')
  assert.equal(newCommand.settings.uploadBaseUrl, undefined)
  assert.deepEqual(install(vault), [])
  config.choices[1].macro.commands[0].path = 'user-custom.js'
  fs.writeFileSync(configPath, JSON.stringify(config))
  assert.throws(() => install(vault, true), /different implementation/)
})
