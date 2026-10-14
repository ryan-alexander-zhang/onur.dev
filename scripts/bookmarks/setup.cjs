const { schema, setup, createClient, readSettings } = require('./lib.cjs')
if (!process.argv.includes('--apply')) console.info(JSON.stringify(schema, null, 2))
else
  setup(createClient(readSettings()))
    .then(() => console.info('Bookmark Catalog model ready; no catalog published.'))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
