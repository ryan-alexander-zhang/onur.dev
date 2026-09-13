const { test, expect } = require('@playwright/test')
const fs = require('node:fs')

async function reset(request, mode) {
  fs.writeFileSync(process.env.JOURNAL_UI_STATE, mode)
  const response = await request.post('/api/revalidate', {
    headers: { 'x-revalidate-secret': 'journal-ui-fixture' },
    data: { contentTypeId: 'journalEntry' }
  })
  expect(response.ok()).toBeTruthy()
}
const timeline = (page) => page.locator('nav[aria-label="Journal timeline"]:visible')
const firstEntry = '/journey/20260913082051'
const longEntry = '/journey/20260912090000'

test('timeline selects a single reading pane, with full long entries and mobile return', async ({
  page,
  request,
  isMobile
}, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await reset(request, 'entries')
  await page.route('https://unpkg.com/**', (route) => route.abort())
  await page.goto('/journey')
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect(timeline(page).getByRole('list', { name: '2026 journal entries' }).locator(':scope > li')).toHaveCount(3)
  await expect(timeline(page).getByRole('list', { name: '2025 journal entries' }).locator(':scope > li')).toHaveCount(1)
  await expect(timeline(page).locator('time').first()).toHaveText('Sep 13')
  await expect(page.getByText('Read entry', { exact: true })).toHaveCount(0)
  await timeline(page).locator(`a[href="${firstEntry}"]`).click()
  await expect(page).toHaveURL(new RegExp(`${firstEntry}$`))
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1, name: 'September 13, 2026' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Log', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Thoughts', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Review', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'the related card' })).toHaveAttribute('href', '/cards/20260908201230')
  await expect(page.getByText('Knowledge to Develop', { exact: true })).toHaveCount(0)
  await expect(page.locator('details, [aria-label="Table of contents"]')).toHaveCount(0)
  if (isMobile) {
    await expect(timeline(page)).toHaveCount(0)
  } else {
    await expect(timeline(page).locator(`a[href="${firstEntry}"]`)).toHaveAttribute('aria-current', 'page')
    const navBox = await timeline(page).boundingBox()
    const bodyBox = await page.getByRole('article').boundingBox()
    expect(bodyBox.x).toBeGreaterThan(navBox.x + navBox.width)
  }
  await page.screenshot({ path: testInfo.outputPath('journey-reading.png'), fullPage: true, scale: 'css' })
  if (isMobile) await page.getByRole('link', { name: 'Go back' }).click()
  await timeline(page).locator(`a[href="${longEntry}"]`).click()
  await expect(page.getByRole('heading', { level: 1, name: 'A little room to think' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Thoughts' })).toContainText('Long reflection for expansion testing.')
  await expect(page.getByRole('region', { name: 'Review' })).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(1)
  expect(await page.getByRole('article').evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  expect(errors).toEqual([])
})

test('entry URLs survive reload, history and unknown IDs', async ({ page, request, isMobile }) => {
  await reset(request, 'entries')
  await page.goto(firstEntry)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'September 13, 2026' })).toBeVisible()
  if (isMobile) await page.getByRole('link', { name: 'Go back' }).click()
  await timeline(page)
    .getByRole('link', { name: /An earlier moment/ })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'An earlier moment' })).toBeVisible()
  await page.goBack()
  if (isMobile) await expect(timeline(page)).toBeVisible()
  else await expect(page.getByRole('heading', { level: 1, name: 'September 13, 2026' })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1, name: 'An earlier moment' })).toBeVisible()
  await page.goto('/journey/00000000000000')
  await expect(page.getByRole('heading', { name: 'Entry not found' })).toBeVisible()
})

test('empty timeline is honest and authenticated refresh is required', async ({ page, request, isMobile }) => {
  const unauthorized = await request.post('/api/revalidate', { data: { contentTypeId: 'journalEntry' } })
  expect(unauthorized.status()).toBe(401)
  await reset(request, 'empty')
  await page.goto('/journey')
  if (isMobile)
    await expect(page.getByText('Notes and reflections will appear here.').filter({ visible: true })).toBeVisible()
  else await expect(page.getByRole('heading', { name: 'More along the way' })).toBeVisible()
  await expect(page.getByRole('list', { name: '2026 journal entries' })).toHaveCount(0)
})
