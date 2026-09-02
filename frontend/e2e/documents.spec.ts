import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

import {
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
} from './support/api'

const documents = [
  {
    currencyCode: 'EUR',
    dueDate: '2026-09-12',
    invoiceDate: '2026-08-13',
    invoiceId: 42,
    invoiceNumber: 'INV-2026-0421',
    status: 'ARCHIVEE',
    supplierName: 'Leroy Construction',
    totalTtc: '1260.00',
  },
  {
    currencyCode: 'EUR',
    dueDate: '2026-09-10',
    invoiceDate: '2026-08-10',
    invoiceId: 43,
    invoiceNumber: 'OB-2026-0812',
    status: 'EXPORTEE',
    supplierName: 'Orange Business',
    totalTtc: '428.00',
  },
]

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFAgIACa4L9QAAAABJRU5ErkJggg==',
  'base64',
)

const fileHeaders = {
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-allow-origin': '*',
}

async function fulfillPreview(route: Route) {
  expect(route.request().headers().authorization).toBe('Bearer e2e-token')
  await route.fulfill({
    body: transparentPng,
    contentType: 'image/png',
    headers: fileHeaders,
    status: 200,
  })
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('renders accessible documents in the Figma table view', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('page')).toBe('0')
    expect(url.searchParams.get('size')).toBe('8')
    await fulfillJson(route, 200, {
      content: documents,
      number: 0,
      size: 8,
      totalElements: 14,
      totalPages: 2,
    })
  })

  await page.goto('/documents')

  await expect(page.getByRole('heading', { exact: true, name: 'Documents' })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByText('Invoice INV-2026-0421')).toBeVisible()
  await expect(page.getByText('Leroy Construction')).toBeVisible()
  await expect(page.getByText('€1,260.00')).toBeVisible()
  await expect(page.getByText('1–8 of 14 documents')).toBeVisible()

  await page.getByRole('link', { name: 'Open document INV-2026-0421' }).click()
  await expect(page).toHaveURL(/\/invoices\/42$/)
})

test('loads protected previews and preserves filters when changing view', async ({ page }) => {
  const listRequests: URL[] = []
  let downloadRequests = 0

  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const url = new URL(route.request().url())
    listRequests.push(url)
    await fulfillJson(route, 200, {
      content: documents,
      number: Number(url.searchParams.get('page')),
      size: Number(url.searchParams.get('size')),
      totalElements: 14,
      totalPages: url.searchParams.get('size') === '6' ? 3 : 2,
    })
  })
  await mockApiRoute(page, '/v1/invoices/*/preview', fulfillPreview)
  await mockApiRoute(page, '/v1/invoices/*/file', async (route) => {
    downloadRequests += 1
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    await route.fulfill({
      body: Buffer.from('%PDF-1.4\n%%EOF'),
      contentType: 'application/pdf',
      headers: fileHeaders,
      status: 200,
    })
  })

  await page.goto('/documents?view=grid&query=leroy&status=VALIDEE&page=2')

  await expect(page.getByLabel('Document preview grid')).toBeVisible()
  await expect(page.getByAltText('Preview of INV-2026-0421')).toBeVisible()
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('size')).toBe('6')
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('page')).toBe('1')

  await page.getByRole('button', { name: 'Download document INV-2026-0421' }).click()
  await expect.poll(() => downloadRequests).toBe(1)

  await page.getByRole('button', { name: 'Table' }).click()

  await expect(page.getByRole('table')).toBeVisible()
  await expect(page).toHaveURL(/query=leroy/)
  await expect(page).toHaveURL(/status=VALIDEE/)
  await expect(page).toHaveURL(/page=1/)
  expect(new URL(page.url()).searchParams.has('view')).toBe(false)
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('size')).toBe('8')
})

test('keeps the page available while retrying a document list error', async ({ page }) => {
  let attempts = 0
  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    attempts += 1
    await fulfillJson(route, attempts === 1 ? 503 : 200, attempts === 1 ? {} : {
      content: documents,
      number: 0,
      size: 8,
      totalElements: 2,
      totalPages: 1,
    })
  })

  await page.goto('/documents')

  await expect(page.getByText('Unable to load documents')).toBeVisible()
  await expect(page.getByRole('heading', { exact: true, name: 'Documents' })).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Invoice INV-2026-0421')).toBeVisible()
  expect(attempts).toBe(2)
})

test('shows the document library empty state', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, {
    content: [],
    number: 0,
    size: 8,
    totalElements: 0,
    totalPages: 0,
  }))

  await page.goto('/documents')

  await expect(page.getByRole('heading', { name: 'No documents yet' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to inbox' })).toHaveAttribute(
    'href',
    '/inbox?upload=1',
  )
})
