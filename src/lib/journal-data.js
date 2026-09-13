export const JOURNAL_CACHE_TAG = 'journal-entries'

const QUERY = `query JournalEntries($preview: Boolean!, $skip: Int!, $limit: Int!, $locale: String) {
  journalEntryCollection(preview: $preview, skip: $skip, limit: $limit, locale: $locale, order: [date_DESC, noteId_DESC]) {
    total
    items { noteId title date tags log thoughts review linkedNoteIds }
  }
}`
const string = (value) => (typeof value === 'string' ? value : '')
const strings = (value) => [...new Set(Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v) : [])]

export function normalizeJournal(item) {
  return {
    noteId: string(item.noteId),
    title: string(item.title),
    date: string(item.date).slice(0, 10),
    tags: strings(item.tags),
    log: string(item.log),
    thoughts: string(item.thoughts),
    review: string(item.review),
    linkedNoteIds: strings(item.linkedNoteIds)
  }
}

export function groupJournalByYear(entries) {
  const groups = []
  const sorted = entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && (e.log || e.thoughts || e.review))
    .toSorted((a, b) => b.date.localeCompare(a.date) || b.noteId.localeCompare(a.noteId))
  for (const entry of sorted) {
    const year = entry.date.slice(0, 4)
    if (groups.at(-1)?.year !== year) groups.push({ year, entries: [] })
    groups.at(-1).entries.push(entry)
  }
  return groups
}

export async function fetchJournalEntries({ preview = false, env = process.env, fetcher = fetch } = {}) {
  const token = preview ? env.CONTENTFUL_PREVIEW_ACCESS_TOKEN : env.CONTENTFUL_ACCESS_TOKEN
  if (!env.CONTENTFUL_SPACE_ID || !token) return []
  const endpoint = `https://graphql.contentful.com/content/v1/spaces/${encodeURIComponent(env.CONTENTFUL_SPACE_ID)}/environments/${encodeURIComponent(env.CONTENTFUL_ENVIRONMENT_ID || 'master')}`
  const entries = new Map()
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
    if (!response.ok && response.status !== 400) throw new Error(`Journal request failed (${response.status})`)
    const payload = await response.json()
    if (payload.errors?.length) {
      if (
        payload.errors.every((error) =>
          /Cannot query field ["']journalEntryCollection["'] on type ["']Query["']/.test(error.message || '')
        )
      )
        return []
      throw new Error('Journal GraphQL request failed')
    }
    if (!response.ok) throw new Error(`Journal request failed (${response.status})`)
    const collection = payload.data?.journalEntryCollection
    if (!collection || !Array.isArray(collection.items) || !Number.isInteger(collection.total) || collection.total < 0)
      throw new Error('Invalid Journal collection')
    for (const item of collection.items)
      if (item) {
        const entry = normalizeJournal(item)
        if (entry.noteId) entries.set(entry.noteId, entry)
      }
    skip += collection.items.length
    if (skip >= collection.total) break
    if (!collection.items.length) throw new Error('Journal pagination stopped early')
  }
  return [...entries.values()]
}
