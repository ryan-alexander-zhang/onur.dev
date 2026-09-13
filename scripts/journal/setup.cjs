const { schema, setup, createClient, readSettings } = require('./lib.cjs')
if (!process.argv.includes('--apply')) console.info(JSON.stringify(schema, null, 2))
else
  setup(createClient(readSettings()))
    .then(() => console.info('Journal Entry model published; no notes were uploaded.'))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
