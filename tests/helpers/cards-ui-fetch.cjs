require('./journal-ui-fetch.cjs')
const originalFetch = globalThis.fetch
const items = [
  {
    noteId: '20261013090000',
    title: '图片卡片',
    titleEn: 'Image card',
    tags: ['images'],
    bodyZh:
      '行内图片 ![中文配图](https://cards.test/zh.svg) 之后的文字。\n\n![本地图片](photo.png)\n\n![不安全图片](javascript:alert)\n\n[另一张卡片](/cards/20261013090001)',
    bodyEn: '![English illustration](https://cards.test/en.svg)',
    sources: '![来源配图](https://cards.test/source.svg)',
    linkedNoteIds: ['20261013090001']
  },
  { noteId: '20261013090001', title: '另一张卡片', tags: ['images'], bodyZh: '用于检查卡片导航。' }
]

globalThis.fetch = async (input, options) => {
  if (String(input?.url || input).startsWith('https://graphql.contentful.com/')) {
    const body = JSON.parse(options?.body || (input?.clone ? await input.clone().text() : '{}'))
    if (body.query?.includes('permanentNoteCollection')) {
      return Response.json({ data: { permanentNoteCollection: { total: items.length, items } } })
    }
  }
  return originalFetch(input, options)
}
