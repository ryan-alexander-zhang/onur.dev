const schema = require('./schema.json')
const { createClient, readSettings, CONTENT_TYPE } = require('./lib.cjs')

async function setup(client) {
  const path = `/content_types/${CONTENT_TYPE}`
  const existing = await client.request('GET', path)
  // Never delete unknown fields or change an incompatible field's type.
  if (existing)
    for (const field of existing.fields) {
      const desired = schema.fields.find((f) => f.id === field.id)
      if (
        !desired ||
        desired.type !== field.type ||
        field.localized ||
        (desired.type === 'Array' && field.items?.type !== desired.items.type)
      )
        throw new Error(`Model requires manual migration: ${field.id}`)
    }
  const updated = await client.request('PUT', path, schema, existing?.sys.version)
  return client.request('PUT', `${path}/published`, undefined, updated.sys.version)
}

if (require.main === module) {
  if (!process.argv.includes('--apply')) console.info(JSON.stringify(schema, null, 2))
  else
    setup(createClient(readSettings({}, process.env, false)))
      .then(() => console.info('Permanent Note model published.'))
      .catch((error) => {
        console.error(error.message)
        process.exitCode = 1
      })
}
module.exports = { setup }
