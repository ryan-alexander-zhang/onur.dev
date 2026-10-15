const { defineConfig, devices } = require('@playwright/test')
const path = require('node:path')
module.exports = defineConfig({
  testDir: './ui',
  testMatch: 'bookmarks.spec.cjs',
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://localhost:3102', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --port 3102',
    cwd: path.resolve(__dirname, '..'),
    url: 'http://localhost:3102/bookmarks/ai',
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      NODE_OPTIONS: `--require=${path.join(__dirname, 'helpers/bookmarks-ui-fetch.cjs')}`,
      CONTENTFUL_SPACE_ID: 'bookmarks-ui-fixture',
      CONTENTFUL_ACCESS_TOKEN: 'fixture',
      CONTENTFUL_PREVIEW_ACCESS_TOKEN: 'fixture-preview',
      CONTENTFUL_PREVIEW_SECRET: 'fixture-preview',
      NEXT_REVALIDATE_SECRET: 'fixture-revalidate',
      JEV_KEY: 'fixture-server-only-jev-secret'
    }
  }
})
