export const PERMANENT_NOTES_CACHE_TAG = 'permanent-notes'

const QUERY = `query PermanentNotes($preview: Boolean!, $skip: Int!, $limit: Int!, $locale: String) {
  permanentNoteCollection(preview: $preview, skip: $skip, limit: $limit, locale: $locale, order: noteId_ASC) {
    total
    items { noteId title titleEn tags aliases bodyZh bodyEn sources linkedNoteIds }
  }
}`

const strings = (value) => [
  ...new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item) : [])
]
const string = (value) => (typeof value === 'string' ? value : '')

export function normalizePermanentNote(item) {
  return {
    noteId: string(item.noteId),
    title: string(item.title),
    titleEn: string(item.titleEn),
    tags: strings(item.tags),
    aliases: strings(item.aliases),
    bodyZh: string(item.bodyZh),
    bodyEn: string(item.bodyEn),
    sources: string(item.sources),
    linkedNoteIds: strings(item.linkedNoteIds)
  }
}

/** Missing configuration/model is a setup state; transport and authorization errors remain visible. */
export async function fetchPermanentNotes({ preview = false, env = process.env, fetcher = fetch } = {}) {
  const token = preview ? env.CONTENTFUL_PREVIEW_ACCESS_TOKEN : env.CONTENTFUL_ACCESS_TOKEN
  if (!env.CONTENTFUL_SPACE_ID || !token) return []
  const environment = env.CONTENTFUL_ENVIRONMENT_ID || 'master'
  const endpoint = `https://graphql.contentful.com/content/v1/spaces/${encodeURIComponent(env.CONTENTFUL_SPACE_ID)}/environments/${encodeURIComponent(environment)}`
  const notes = new Map()
  let skip = 0
  while (true) {
    const response = await fetcher(endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: QUERY,
        variables: { preview, skip, limit: 100, locale: env.CONTENTFUL_LOCALE || null }
      })
    })
    // GraphQL validation errors may use either HTTP 200 or 400.
    if (!response.ok && response.status !== 400) {
      throw new Error(`Contentful permanent notes request failed (${response.status})`)
    }
    const payload = await response.json()
    if (payload.errors?.length) {
      const missingModel = payload.errors.every((error) =>
        /Cannot query field ["']permanentNoteCollection["'] on type ["']Query["']/.test(error.message ?? '')
      )
      if (missingModel) return []
      throw new Error('Contentful permanent notes GraphQL request failed')
    }
    if (!response.ok) throw new Error(`Contentful permanent notes request failed (${response.status})`)
    const collection = payload.data?.permanentNoteCollection
    if (
      !collection ||
      !Array.isArray(collection.items) ||
      !Number.isInteger(collection.total) ||
      collection.total < 0
    ) {
      throw new Error('Contentful permanent notes returned an invalid collection')
    }
    for (const item of collection.items) {
      if (!item) continue
      const note = normalizePermanentNote(item)
      if (note.noteId) notes.set(note.noteId, note)
    }
    skip += collection.items.length
    if (skip >= collection.total) break
    if (!collection.items.length) throw new Error('Contentful permanent notes pagination stopped before completion')
  }
  return [...notes.values()]
}
