require('./journal-ui-fetch.cjs')
const originalFetch = globalThis.fetch
const snapshot = {
  version: 1,
  groups: [
    { id: 'ai', slug: 'ai', title: 'AI' },
    { id: 'design', slug: 'design', title: 'Design' }
  ],
  items: Array.from({ length: 63 }, (_, index) => ({
    id: String(20261013000000 + index),
    groupId: index < 61 ? 'ai' : 'design',
    title: `Bookmark ${index + 1}`,
    url: `https://bookmarks.test/${index + 1}`,
    description: 'A carefully selected resource for building useful software. 精选资源，记录用途与内容摘要。',
    cover: 'https://bookmarks.test/cover.svg',
    created: '2026-10-13T00:00:00.000Z',
    kind: 'tool',
    tags: ['resource']
  }))
}
globalThis.fetch = async (input, options) => {
  if (String(input?.url || input).startsWith('https://graphql.contentful.com/')) {
    const body = JSON.parse(options?.body || (input?.clone ? await input.clone().text() : '{}'))
    if (body.query?.includes('query BookmarkCatalog')) {
      const data = structuredClone(snapshot)
      if (body.variables.preview) data.items[0].title = 'Draft bookmark'
      return Response.json({ data: { bookmarkCatalog: { snapshot: data } } })
    }
  }
  return originalFetch(input, options)
}
