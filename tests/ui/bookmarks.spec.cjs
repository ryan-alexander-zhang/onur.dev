const { test, expect } = require('@playwright/test')
const cards = (page) => page.locator('a[data-bookmark-order]:visible')
test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/**', (route) => route.abort())
  await page.route('https://bookmarks.test/cover.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#eef2ff"/><text x="90" y="345" font-size="76" fill="#334155">Bookmark preview</text></svg>'
    })
  )
})
test('cards preserve responsive layout, pagination and collection switching', async ({ page, isMobile }, info) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/bookmarks/ai')
  await expect(page.getByRole('heading', { name: 'AI', exact: true })).toBeVisible()
  await expect(cards(page)).toHaveCount(50)
  const first = await cards(page).nth(0).boundingBox(),
    second = await cards(page).nth(1).boundingBox()
  if (isMobile) expect(Math.abs(first.x - second.x)).toBeLessThan(2)
  else {
    const thirdColumn = await cards(page).nth(25).boundingBox()
    expect(thirdColumn.x).toBeGreaterThan(first.x + first.width)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.screenshot({ path: info.outputPath('bookmarks.png'), fullPage: false, scale: 'css' })
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(cards(page)).toHaveCount(61)
  await expect(page.getByText("That's all for now. Come back later for more.")).toBeVisible()
  await page.goto('/bookmarks/design')
  await expect(cards(page)).toHaveCount(2)
  await expect(cards(page).first()).toContainText('Bookmark 62')
  expect(errors).toEqual([])
})
test('draft mode is isolated from published data and refresh requires authentication', async ({ page, request }) => {
  const denied = await request.post('/api/revalidate', { data: { contentTypeId: 'bookmarkCatalog' } })
  expect(denied.status()).toBe(401)
  const refresh = await request.post('/api/revalidate', {
    headers: { 'x-revalidate-secret': 'fixture-revalidate' },
    data: { contentTypeId: 'bookmarkCatalog', slugs: ['ai'] }
  })
  expect(refresh.ok()).toBeTruthy()
  await page.goto('/api/draft?secret=fixture-preview&slug=/bookmarks/ai')
  await expect(cards(page).first()).toContainText('Draft bookmark')
  const rss = await request.get('/bookmarks.xml')
  expect(await rss.text()).not.toContain('Draft bookmark')
  expect(await rss.text()).toContain('Bookmark 1')
})
