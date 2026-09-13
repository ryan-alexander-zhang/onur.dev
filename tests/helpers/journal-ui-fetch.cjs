// Loaded only by the Journal UI test server via NODE_OPTIONS. Never imported by the app.
const fs = require('node:fs')
const originalFetch = globalThis.fetch
const items = [
  {
    noteId: '20260913082051',
    title: '2026-09-13',
    date: '2026-09-13T00:00:00.000Z',
    tags: ['building', 'learning'],
    log: '今天把零散的记录整理到一起，也给自己留了一点慢下来的时间。\n\n- 完成了一个小功能\n- 下午沿着河边散步，拍了几张照片',
    thoughts:
      '好的记录不一定需要一个完整的结论。有时，把还没想清楚的问题留下来，就已经足够。\n\nSee [the related card](/cards/20260908201230).',
    review:
      '### 👍 What Went Well\n\n把注意力放在一件事上，比不断切换任务更有效。\n\n### 💡 What I Realized Today\n\n进步也可以很安静。',
    linkedNoteIds: ['20260908201230']
  },
  {
    noteId: '20260913070000',
    title: 'An earlier moment',
    date: '2026-09-13T00:00:00.000Z',
    tags: [],
    log: 'Another entry on the same day has its own place on the timeline.',
    thoughts: '',
    review: '',
    linkedNoteIds: []
  },
  {
    noteId: '20260912090000',
    title: 'A little room to think',
    date: '2026-09-12T00:00:00.000Z',
    tags: ['reflection'],
    log: 'A slower morning, a notebook, and a walk without a destination.',
    thoughts: 'Long reflection for expansion testing. '.repeat(50),
    review: '',
    linkedNoteIds: []
  },
  {
    noteId: '20251231120000',
    title: 'Closing the year',
    date: '2025-12-31T00:00:00.000Z',
    tags: [],
    log: '',
    thoughts: '',
    review: 'I am grateful for the small things that became a habit.',
    linkedNoteIds: []
  }
]
globalThis.fetch = async (input, options) => {
  const url = String(input?.url || input)
  if (url.startsWith('https://graphql.contentful.com/')) {
    const body = JSON.parse(options?.body || (input?.clone ? await input.clone().text() : '{}'))
    if (body.query?.includes('journalEntryCollection')) {
      const empty = fs.readFileSync(process.env.JOURNAL_UI_STATE, 'utf8') === 'empty'
      return Response.json({
        data: { journalEntryCollection: { total: empty ? 0 : items.length, items: empty ? [] : items } }
      })
    }
    return Response.json({
      data: {
        postCollection: { items: [] },
        pageCollection: { items: [] },
        permanentNoteCollection: { total: 0, items: [] }
      }
    })
  }
  if (url.startsWith('https://api.github.com/users/'))
    return Response.json({
      name: 'Ryan Alexander Zhang',
      bio: 'I love persimmon.',
      avatar_url: '/icon.png',
      html_url: 'https://github.com/ryan-alexander-zhang'
    })
  return originalFetch(input, options)
}
