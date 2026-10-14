export const BOOKMARKS_CACHE_TAG = 'bookmark-catalog'
export const BOOKMARK_CATALOG_ID = 'bookmarkCatalog_main'
export const PAGE_SIZE = 50
const emptyCatalog = () => ({ version: 1, groups: [], items: [] })
const string = (v) => (typeof v === 'string' ? v : '')
const safeUrl = (v) => {
  try {
    const u = new URL(v)
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''
  } catch {
    return ''
  }
}

export function normalizeCatalog(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.groups) || !Array.isArray(snapshot.items))
    throw new Error('Unsupported or invalid bookmark catalog')
  const groupIds = new Set(),
    ids = new Set()
  const groups = snapshot.groups.map((g) => {
    if (!g || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(g.slug) || g.id !== g.slug || !string(g.title) || groupIds.has(g.id))
      throw new Error('Invalid or duplicate bookmark group')
    groupIds.add(g.id)
    return { _id: g.id, slug: g.slug, title: g.title, count: 0 }
  })
  const items = snapshot.items.map((item) => {
    if (
      !item ||
      !string(item.id) ||
      ids.has(item.id) ||
      !groupIds.has(item.groupId) ||
      !safeUrl(item.url) ||
      !string(item.title) ||
      !Number.isFinite(Date.parse(item.created))
    )
      throw new Error('Invalid or duplicate bookmark')
    ids.add(item.id)
    return {
      _id: item.id,
      title: item.title,
      link: safeUrl(item.url),
      domain: new URL(item.url).hostname,
      excerpt: string(item.description),
      cover: safeUrl(item.cover),
      collectionId: item.groupId,
      kind: string(item.kind),
      tags: Array.isArray(item.tags) ? item.tags.filter((t) => typeof t === 'string') : [],
      created: item.created,
      lastUpdate: item.created
    }
  })
  for (const group of groups) group.count = items.filter((i) => i.collectionId === group._id).length
  return { version: 1, groups: groups.filter((g) => g.count), items }
}

export function paginateBookmarks(catalog, id, pageIndex = 0) {
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 0) throw new Error('Invalid bookmark page')
  const items = catalog.items.filter((item) => item.collectionId === id)
  return { result: true, count: items.length, items: items.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE) }
}

export async function fetchBookmarkCatalog({ preview = false, env = process.env, fetcher = fetch } = {}) {
  const token = preview ? env.CONTENTFUL_PREVIEW_ACCESS_TOKEN : env.CONTENTFUL_ACCESS_TOKEN
  if (!env.CONTENTFUL_SPACE_ID || !token) return emptyCatalog()
  const endpoint = `https://graphql.contentful.com/content/v1/spaces/${encodeURIComponent(env.CONTENTFUL_SPACE_ID)}/environments/${encodeURIComponent(env.CONTENTFUL_ENVIRONMENT_ID || 'master')}`
  const response = await fetcher(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      query:
        'query BookmarkCatalog($id: String!, $preview: Boolean!, $locale: String) { bookmarkCatalog(id: $id, preview: $preview, locale: $locale) { snapshot sys { publishedAt } } }',
      variables: { id: BOOKMARK_CATALOG_ID, preview, locale: env.CONTENTFUL_LOCALE || null }
    })
  })
  if (!response.ok && response.status !== 400) throw new Error(`Bookmark catalog request failed (${response.status})`)
  const payload = await response.json()
  if (payload.errors?.length) {
    if (
      payload.errors.every((e) =>
        /Cannot query field ["']bookmarkCatalog["'] on type ["']Query["']/.test(e.message || '')
      )
    )
      return emptyCatalog()
    throw new Error('Bookmark catalog GraphQL request failed')
  }
  if (!response.ok || !payload.data || !Object.hasOwn(payload.data, 'bookmarkCatalog'))
    throw new Error('Invalid bookmark catalog response')
  const entry = payload.data.bookmarkCatalog
  if (!entry) return emptyCatalog()
  return { ...normalizeCatalog(entry.snapshot), publishedAt: entry.sys?.publishedAt }
}
