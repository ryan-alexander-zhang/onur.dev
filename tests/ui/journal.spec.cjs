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
test('timeline uses upstream list items, dates, sections, cards and expandable long entries', async ({
  page,
  request
}, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await reset(request, 'entries')
  await page.route('https://unpkg.com/**', (route) => route.abort())
  await page.goto('/journey')
  await expect(page.getByRole('heading', { name: 'Journey', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: '2026 journal entries' }).locator(':scope > li')).toHaveCount(2)
  await expect(page.getByRole('list', { name: '2025 journal entries' }).locator(':scope > li')).toHaveCount(1)
  await expect(page.locator('time').first()).toHaveText('Sep 13')
  await expect(page.getByRole('region', { name: 'Log', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'the related card' })).toHaveAttribute('href', '/cards/20260908201230')
  await expect(page.getByText('Knowledge to Develop', { exact: true })).toHaveCount(0)
  await page.getByText('Read entry', { exact: true }).click()
  await expect(page.getByText('Close entry', { exact: true })).toBeVisible()
  await expect(page.getByText('Long reflection for expansion testing.', { exact: false })).toBeVisible()
  await page.getByText('Close entry', { exact: true }).click()
  const overflow = await page
    .locator('article')
    .evaluateAll((nodes) => nodes.some((el) => el.scrollWidth > el.clientWidth + 1))
  expect(overflow).toBe(false)
  expect(errors).toEqual([])
  await page.locator('#scroll-area').evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: testInfo.outputPath('journey.png'), fullPage: true, scale: 'css' })
})
test('empty timeline is honest and authenticated refresh is required', async ({ page, request }) => {
  const unauthorized = await request.post('/api/revalidate', { data: { contentTypeId: 'journalEntry' } })
  expect(unauthorized.status()).toBe(401)
  await reset(request, 'empty')
  await page.goto('/journey')
  await expect(page.getByRole('heading', { name: 'More along the way' })).toBeVisible()
  await expect(page.getByRole('list', { name: '2026 journal entries' })).toHaveCount(0)
})
