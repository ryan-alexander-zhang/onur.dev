const { defineConfig, devices } = require('@playwright/test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
if (!process.env.JOURNAL_UI_STATE) {
  const stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-ui-'))
  process.env.JOURNAL_UI_STATE = path.join(stateDirectory, 'mode')
  fs.writeFileSync(process.env.JOURNAL_UI_STATE, 'entries')
}
module.exports = defineConfig({
  testDir: './ui',
  testMatch: 'journal.spec.cjs',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://localhost:3101', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 }, timezoneId: 'America/Los_Angeles' }
    },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', timezoneId: 'Asia/Shanghai' } }
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --port 3101',
    cwd: path.resolve(__dirname, '..'),
    url: 'http://localhost:3101/journey',
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      NODE_OPTIONS: `--require=${path.join(__dirname, 'helpers/journal-ui-fetch.cjs')}`,
      JOURNAL_UI_STATE: process.env.JOURNAL_UI_STATE,
      CONTENTFUL_SPACE_ID: 'journal-ui-fixture',
      CONTENTFUL_ACCESS_TOKEN: 'journal-ui-fixture',
      NEXT_REVALIDATE_SECRET: 'journal-ui-fixture'
    }
  }
})
