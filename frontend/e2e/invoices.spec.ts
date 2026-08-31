import { expect, test } from '@playwright/test'

import { fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const firstPage = {
  content: [
    {
      currencyCode: 'EUR',
      dueDate: '2026-08-30',
      invoiceDate: '2026-08-13',
      invoiceId: 42,
      invoiceNumber: 'INV-2026-0042',
      status: 'EXTRAITE',
      supplierName: 'Acme Supplies',
      totalTtc: '1250.50',
    },
    {
      currencyCode: 'EUR',
      dueDate: null,
      invoiceDate: null,
      invoiceId: 43,
      invoiceNumber: null,
      status: 'OCR_EN_COURS',
      supplierName: null,
      totalTtc: null,
    },
  ],
  number: 0,
  size: 8,
  totalElements: 26,
  totalPages: 4,
}

const emptyPage = {
  content: [],
  number: 0,
  size: 8,
  totalElements: 0,
  totalPages: 0,
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('renders the paginated API data and opens the selected invoice', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, firstPage))

  await page.goto('/invoices')

  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  await expect(page.getByText('Acme Supplies')).toBeVisible()
  await expect(page.getByText('13 Aug')).toBeVisible()
  await expect(page.getByText('€1,250.50')).toBeVisible()
  await expect(page.getByText('Needs review')).toBeVisible()
  await expect(page.getByText('1–8 of 26 invoices')).toBeVisible()

  await page.getByRole('link', { name: 'Open invoice INV-2026-0042' }).click()

  await expect(page).toHaveURL(/\/invoices\/42$/)
  await expect(page.getByRole('heading', { name: 'Invoice details' })).toBeVisible()
})

test('keeps current filters while changing page and sort', async ({ page }) => {
  const requestedUrls: URL[] = []

  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const requestUrl = new URL(route.request().url())
    requestedUrls.push(requestUrl)
    const number = Number(requestUrl.searchParams.get('page'))

    await fulfillJson(route, 200, {
      ...firstPage,
      number,
    })
  })

  await page.goto('/invoices?status=EXTRAITE')
  await expect(page.getByText('Acme Supplies')).toBeVisible()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page).toHaveURL(/status=EXTRAITE.*page=2/)
  await expect.poll(() => requestedUrls.at(-1)?.searchParams.get('page')).toBe('1')

  await page.getByRole('button', { name: 'Total' }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('EXTRAITE')
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1')
  await expect.poll(() => new URL(page.url()).searchParams.get('sortBy')).toBe('totalTtc')
  await expect.poll(() => new URL(page.url()).searchParams.get('direction')).toBe('DESC')
  await expect.poll(() => requestedUrls.at(-1)?.searchParams.get('sortBy')).toBe('totalTtc')
  expect(requestedUrls.at(-1)?.searchParams.get('direction')).toBe('DESC')
})

test('shows an empty state when the organization has no invoices', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, emptyPage))

  await page.goto('/invoices')

  await expect(page.getByRole('heading', { name: 'No invoices yet' })).toBeVisible()
  await expect(page.locator('section').getByRole('link', { name: 'Upload invoices' })).toHaveAttribute(
    'href',
    '/inbox?upload=1',
  )
})

test('lets the user retry after an API error', async ({ page }) => {
  let requestCount = 0

  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    requestCount += 1
    await fulfillJson(route, requestCount === 1 ? 503 : 200, requestCount === 1
      ? { message: 'Unavailable' }
      : emptyPage)
  })

  await page.goto('/invoices')
  await expect(page.getByRole('alert')).toContainText('Unable to load invoices')

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(page.getByRole('heading', { name: 'No invoices yet' })).toBeVisible()
  expect(requestCount).toBe(2)
})

test('keeps the invoice table contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, firstPage))

  await page.goto('/invoices')
  await expect(page.getByText('Acme Supplies')).toBeVisible()

  const documentWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client)
})
