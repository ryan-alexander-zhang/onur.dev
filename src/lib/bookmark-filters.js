// Exact tags intentionally preserve Obsidian namespaces (e.g. resource/course).
export function readBookmarkFilters(params) {
  return {
    query: params.get('q') || '',
    tags: [...new Set(params.getAll('tag').filter(Boolean))],
    sort: ['oldest', 'title'].includes(params.get('sort')) ? params.get('sort') : 'latest'
  }
}
export function filterBookmarks(items, { group = '', query = '', tags = [], sort = 'latest' } = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const results = items.filter((item) => {
    if (group && item.collectionId !== group) return false
    if (!tags.every((tag) => item.tags.includes(tag))) return false
    const text = [item.title, item.excerpt, item.domain].join(' ').toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
  return results.sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title) || a._id.localeCompare(b._id)
    const delta = Date.parse(b.created) - Date.parse(a.created)
    return (sort === 'oldest' ? -delta : delta) || 0
  })
}
export function bookmarkTagOptions(items, filters) {
  const pool = filterBookmarks(items, { ...filters, tags: [] })
  const matching = filterBookmarks(pool, { tags: filters.tags })
  const counts = new Map()
  for (const item of pool) for (const tag of item.tags) counts.set(tag, 0)
  for (const item of matching) for (const tag of item.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  for (const tag of filters.tags) if (!counts.has(tag)) counts.set(tag, 0)
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort(
      (a, b) =>
        Number(filters.tags.includes(b.tag)) - Number(filters.tags.includes(a.tag)) ||
        b.count - a.count ||
        a.tag.localeCompare(b.tag)
    )
}
