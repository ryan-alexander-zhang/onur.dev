const path = require('node:path')
const base = require('./journal-ui.config.cjs')

module.exports = {
  ...base,
  testMatch: 'cards.spec.cjs',
  webServer: {
    ...base.webServer,
    url: 'http://localhost:3101/cards',
    env: {
      ...base.webServer.env,
      NODE_OPTIONS: `--require=${path.join(__dirname, 'helpers/cards-ui-fetch.cjs')}`
    }
  }
}
