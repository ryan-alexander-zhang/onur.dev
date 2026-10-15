const { test, expect } = require('@playwright/test')
const cards = (page) => page.locator('article[data-bookmark-order]:visible')
test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/**', (route) => route.abort())
  await page.route('https://bookmarks.test/broken.png', (route) => route.fulfill({ status: 404, body: '' }))
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

test('single search supports content, consecutive hashtag chips, history and removal', async ({
  page,
  isMobile
}, info) => {
  await page.goto('/bookmarks')
  const input = page.getByRole('combobox', { name: 'Search bookmarks' })
  await expect(page.getByRole('heading', { name: 'All bookmarks' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tags', exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Sort bookmarks' })).toHaveCount(0)
  await input.fill('Bookmark 61')
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Bookmark 61')
  await input.fill('#tool')
  await expect(page.getByRole('listbox', { name: 'Tag suggestions' })).toBeVisible()
  await input.press('Enter')
  await expect(page.getByRole('button', { name: 'Remove tool', exact: true })).toBeAttached()
  await input.fill('#rare')
  await page.getByRole('option', { name: /^rare / }).click()
  await expect(cards(page)).toHaveCount(2)
  await expect(page).toHaveURL(/tag=tool&tag=rare/)
  await input.fill('#resource')
  await page.screenshot({ path: info.outputPath('search-suggestions.png'), animations: 'disabled' })
  await input.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await input.fill('')
  if (isMobile) await page.getByLabel('Bookmark group', { exact: true }).selectOption('ai')
  else await page.getByRole('navigation', { name: 'Bookmark groups' }).getByRole('link', { name: /^AI / }).click()
  await expect(cards(page)).toHaveCount(1)
  await expect(page).toHaveURL(/bookmarks\/ai\?tag=tool&tag=rare/)
  await page.reload()
  await expect(cards(page)).toHaveCount(1)
  const remove = page.getByRole('button', { name: 'Remove rare', exact: true })
  if (!isMobile) {
    await expect(remove).toHaveCSS('opacity', '0')
    await remove.locator('..').hover()
  }
  await expect(remove).toHaveCSS('opacity', '1')
  await remove.click()
  await expect(cards(page)).toHaveCount(31)
  await page.goBack()
  await expect(cards(page)).toHaveCount(1)
  await page.goForward()
  await expect(cards(page)).toHaveCount(31)
  await input.focus()
  await input.press('Backspace')
  await expect(cards(page)).toHaveCount(50)
  await input.fill('impossible-query')
  await expect(page.getByText('No bookmarks found.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(cards(page)).toHaveCount(50)
})

test('hashtag completion preserves content search, namespaces, keyboard and composition', async ({ page }) => {
  await page.goto('/bookmarks/ai')
  const input = page.getByRole('combobox', { name: 'Search bookmarks' })
  await input.fill('Bookmark 61 #resource/')
  await expect(cards(page)).toHaveCount(1)
  await input.press('Tab')
  await expect(page).toHaveURL(/q=Bookmark\+61&tag=resource%2Fcourse/)
  await expect(input).toHaveValue('Bookmark 61 ')
  await input.fill('Bookmark 61 #tool ')
  await expect(page.getByRole('button', { name: 'Remove tool', exact: true })).toBeAttached()
  await expect(cards(page)).toHaveCount(1)
  await input.fill('Bookmark 61 #missing')
  await expect(page.getByText('No matching tags', { exact: true })).toBeVisible()
  await input.press('Enter')
  await expect(page).not.toHaveURL(/tag=missing/)
  await input.fill('Bookmark 61 #rare')
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  await expect(page).not.toHaveURL(/tag=rare/)
  await input.press('Enter')
  await expect(page).toHaveURL(/tag=rare/)
})

test('missing, legacy and failed covers render without placeholder image requests', async ({ page }, info) => {
  const placeholderRequests = []
  page.on('request', (request) => {
    if (request.url().includes('fallback.avif')) placeholderRequests.push(request.url())
  })
  await page.goto('/bookmarks/ai')
  for (const number of [2, 3, 4]) {
    const card = cards(page).filter({ has: page.getByRole('heading', { name: `Bookmark ${number}`, exact: true }) })
    await expect(card.locator('img')).toHaveCount(0)
    await expect(card.locator('[data-bookmark-fallback]')).toBeVisible()
    const bounds = await card.locator('[data-bookmark-fallback]').boundingBox()
    expect(Math.abs(bounds.width / bounds.height - 1200 / 630)).toBeLessThan(0.03)
  }
  const normal = cards(page).filter({ has: page.getByRole('heading', { name: 'Bookmark 1', exact: true }) })
  await expect(normal.locator('img')).toHaveCSS('opacity', '1')
  expect(placeholderRequests).toEqual([])
  await page.screenshot({ path: info.outputPath('generated-covers.png'), animations: 'disabled', scale: 'css' })
})

test('AI search uses server results, preserves tags and returns to local search on edits', async ({ page }) => {
  const upstream = []
  page.on('request', (request) => {
    if (request.url().includes('api.typesafe.ai')) upstream.push(request.url())
  })
  await page.goto('/bookmarks/ai?tag=tool&tag=rare')
  const input = page.getByRole('combobox', { name: 'Search bookmarks' })
  await input.fill('帮我找一个有用的编程资源')
  await expect(cards(page)).toHaveCount(0)
  const responsePromise = page.waitForResponse('/api/bookmarks/search')
  await input.press('Enter')
  const response = await responsePromise
  expect(response.ok()).toBeTruthy()
  expect(response.request().postDataJSON()).toEqual({
    query: '帮我找一个有用的编程资源',
    group: 'ai',
    tags: ['tool', 'rare']
  })
  expect(await response.json()).toEqual({ ids: ['20261013000060'] })
  await expect(page.getByText('1 AI match', { exact: true })).toBeVisible()
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Bookmark 61')
  await page.getByRole('button', { name: 'Use text search' }).click()
  await expect(cards(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Search with AI' }).click()
  await expect(cards(page)).toHaveCount(1)
  await input.fill('no matching resource')
  await expect(page.getByText('1 AI match', { exact: true })).toHaveCount(0)
  await input.press('Enter')
  await expect(page.getByText('No close matches found.', { exact: true })).toBeVisible()
  expect(upstream).toEqual([])
  expect(await page.content()).not.toContain('fixture-server-only-jev-secret')
})

test('typing and tag selection do not call AI; failures preserve local results and retry', async ({ page }) => {
  let calls = 0
  await page.route('**/api/bookmarks/search', (route) => {
    calls++
    return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Limited' }) })
  })
  await page.goto('/bookmarks/ai')
  const input = page.getByRole('combobox', { name: 'Search bookmarks' })
  await input.fill('Bookmark 61 #tool')
  await input.press('Enter')
  await expect(page.getByRole('button', { name: 'Remove tool', exact: true })).toBeAttached()
  expect(calls).toBe(0)
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  expect(calls).toBe(0)
  await input.press('Enter')
  await expect(page.getByText('Too many AI searches. Try again in a minute. Showing text matches.')).toBeVisible()
  await expect(cards(page)).toHaveCount(1)
  await input.press('Enter')
  await expect.poll(() => calls).toBe(2)
})

test('editing while AI is pending discards the old response and recovers cleanly', async ({ page }) => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/bookmarks/search', async (route) => {
    await gate
    await route
      .fulfill({ contentType: 'application/json', body: JSON.stringify({ ids: ['20261013000060'] }) })
      .catch(() => {})
  })
  await page.goto('/bookmarks/ai')
  const input = page.getByRole('combobox', { name: 'Search bookmarks' })
  await input.fill('Find coding resources')
  await input.press('Enter')
  await expect(page.getByText('Finding matching bookmarks…')).toBeVisible()
  await input.fill('Bookmark 2')
  release()
  await expect(page.getByText('Finding matching bookmarks…')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(15)
  await expect(cards(page).filter({ hasText: 'Bookmark 61' })).toHaveCount(0)
})

test('IME composition keeps the input stable and only commits the completed Chinese query', async ({ page }) => {
  let searches = 0
  await page.route('**/api/bookmarks/search', (route) => {
    searches++
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ids: [] }) })
  })
  await page.goto('/bookmarks/ai')
  const input = page.getByRole('combobox', { name: 'Search bookmarks' })
  await input.focus()
  await input.dispatchEvent('compositionstart', { data: '' })
  for (const value of ['z', 'zhong', '中文']) {
    // Use the native setter so React sees real input changes, not only a synthetic keydown.
    await input.evaluate((element, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value)
      element.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: value, inputType: 'insertCompositionText', isComposing: true })
      )
    }, value)
    await expect(input).toHaveValue(value)
    await expect(input).toBeFocused()
    expect(new URL(page.url()).searchParams.has('q')).toBe(false)
    await expect(cards(page)).toHaveCount(50)
  }
  // Some IMEs report a plain Enter before ending composition.
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: false })
  expect(searches).toBe(0)
  // Safari can also emit compositionend before the Enter that accepted the candidate.
  await input.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文' }))
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }))
  })
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('中文')
  await expect(input).toHaveValue('中文')
  await expect(cards(page)).toHaveCount(0)
  expect(searches).toBe(0)
  // A later, deliberate Enter still submits the completed text.
  await page.waitForTimeout(60)
  await input.press('Enter')
  await expect.poll(() => searches).toBe(1)
  await expect(page.getByText('0 AI matches', { exact: true })).toBeVisible()
})
