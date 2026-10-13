const { test, expect } = require('@playwright/test')

test('card images load and zoom without flipping or navigating the carousel', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|cannot be a descendant/i.test(message.text())) {
      errors.push(message.text())
    }
  })
  await page.route('https://unpkg.com/**', (route) => route.abort())
  await page.route('https://cards.test/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#76a9a0"/></svg>'
    })
  )
  await page.goto('/cards/20261013090000')
  const card = page.getByRole('article', { name: '图片卡片', exact: true })
  const chineseImage = card.getByRole('img', { name: '中文配图', exact: true })
  await expect(chineseImage).toBeVisible()
  await expect.poll(() => chineseImage.evaluate((img) => img.naturalWidth)).toBe(800)
  await expect(card.getByText('本地图片', { exact: true })).toBeVisible()
  await expect(card.locator('img[src^="javascript:"], img[src="photo.png"]')).toHaveCount(0)
  expect(await card.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('card-image.png'), fullPage: true })

  await card.getByRole('button', { name: 'Open image: 中文配图', exact: true }).click()
  const lightbox = page.locator('.yarl__root')
  await expect(lightbox).toBeVisible()
  await lightbox.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await lightbox.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(lightbox).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Flip to English' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page).toHaveURL(/\/cards\/20261013090000/)

  await card.getByRole('button', { name: 'Flip to English' }).click()
  await expect(card.getByRole('img', { name: 'English illustration', exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Open image: English illustration', exact: true }).click()
  await expect(lightbox).toBeVisible()
  await lightbox.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(card.getByRole('button', { name: '翻到中文' })).toHaveAttribute('aria-pressed', 'true')

  await card.getByRole('button', { name: '查看来源：图片卡片' }).click()
  const sources = page.getByRole('dialog', { name: '卡片来源', exact: true })
  await expect(sources.getByRole('img', { name: '来源配图', exact: true })).toBeVisible()
  await sources.getByRole('button', { name: 'Open image: 来源配图', exact: true }).click()
  await expect(lightbox).toBeVisible()
  await lightbox.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(sources).toBeVisible()
  await sources.getByRole('button', { name: 'Close', exact: true }).click()

  await card.getByRole('button', { name: '翻到中文' }).click()
  await card.getByRole('link', { name: '另一张卡片', exact: true }).click()
  await expect(page).toHaveURL(/\/cards\/20261013090001/)
  await expect(page.getByRole('article', { name: '另一张卡片', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
