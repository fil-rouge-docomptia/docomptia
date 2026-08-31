import { expect, test } from '@playwright/test'

import {
  currentUser,
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
} from './support/api'

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

const invoiceDetails = {
  accountingEntry: null,
  classification: {
    active: true,
    classificationId: 7,
    createdAt: '2026-08-01T09:00:00',
    description: 'Building and maintenance costs',
    name: 'Construction',
    type: 'EXPENSE',
    updatedAt: '2026-08-01T09:00:00',
  },
  commandReference: 'PO-2026-0184',
  currencyCode: 'EUR',
  dueDate: '2026-09-12',
  duplicateAlerts: [],
  filePath: '/invoices/Leroy Construction — INV-2026-0421.pdf',
  invoiceDate: '2026-08-13',
  invoiceId: 42,
  invoiceNumber: 'INV-2026-0421',
  ocrAnalysis: {
    confidenceScore: '0.91',
    engineName: 'mock-ocr',
    engineVersion: '1.0',
    fields: [
      {
        confidenceScore: '0.95',
        corrected: false,
        fieldName: 'supplierName',
        normalizedValue: 'Leroy Construction',
        rawValue: 'Leroy Construction',
      },
      {
        confidenceScore: '0.96',
        corrected: false,
        fieldName: 'invoiceNumber',
        normalizedValue: 'INV-2026-0421',
        rawValue: 'INV-2026-0421',
      },
      {
        confidenceScore: '0.82',
        corrected: false,
        fieldName: 'totalTva',
        normalizedValue: '250.10',
        rawValue: '250.10',
      },
    ],
    rawText: 'Invoice INV-2026-0421',
    status: 'SUCCESS',
  },
  ocrError: null,
  status: 'EXTRAITE',
  supplierName: 'Leroy Construction',
  totalHt: '1250.50',
  totalTtc: '1500.60',
  totalTva: '250.10',
}

const invoiceHistory = [
  {
    action: 'EXTRAITE',
    author: 'Alex Martin',
    authorId: 1,
    comment: 'OCR analysis completed',
    date: '2026-08-13T10:30:00',
    duplicateAlertId: null,
    fieldName: null,
    newValue: null,
    oldValue: null,
    type: 'STATUS_CHANGE',
  },
]

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('renders the paginated API data and opens the selected invoice', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, firstPage))
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))

  await page.goto('/invoices')

  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
  await expect(page.getByText('Acme Supplies')).toBeVisible()
  await expect(page.getByText('13 Aug')).toBeVisible()
  await expect(page.getByText('€1,250.50')).toBeVisible()
  await expect(page.getByText('Needs review')).toBeVisible()
  await expect(page.getByText('1–8 of 26 invoices')).toBeVisible()

  await page.getByRole('link', { name: 'Open invoice INV-2026-0042' }).click()

  await expect(page).toHaveURL(/\/invoices\/42$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction' })).toBeVisible()
})

test('renders the invoice review sections from the detail endpoint', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))
  await mockApiRoute(page, '/v1/invoices/42/history', (route) => fulfillJson(route, 200, invoiceHistory))

  await page.goto('/invoices/42')

  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction' })).toBeVisible()
  await expect(page.getByText('Leroy Construction — INV-2026-0421.pdf')).toBeVisible()
  await expect(page.getByLabel('Original invoice document')).toBeVisible()
  await expect(page.getByText('1 field requires review')).toBeVisible()
  await expect(page.getByLabel('Supplier name')).toHaveValue('Leroy Construction')
  await expect(page.getByLabel('Total', { exact: true })).toHaveValue('€1,500.60')

  await page.getByRole('tab', { name: 'Accounting' }).click()
  await expect(page.getByRole('heading', { name: 'No accounting entry yet' })).toBeVisible()

  await page.getByRole('tab', { name: 'Approval' }).click()
  await expect(page.getByText('Review the extracted fields, then request approval')).toBeVisible()

  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByText('OCR analysis completed')).toBeVisible()
})

test('keeps an activity error isolated and allows retry', async ({ page }) => {
  let historyRequestCount = 0
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))
  await mockApiRoute(page, '/v1/invoices/42/history', async (route) => {
    historyRequestCount += 1
    await fulfillJson(
      route,
      historyRequestCount === 1 ? 503 : 200,
      historyRequestCount === 1 ? { message: 'Unavailable' } : invoiceHistory,
    )
  })

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to load activity')
  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction' })).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('OCR analysis completed')).toBeVisible()
})

test('submits an extracted invoice for approval and refreshes the available action', async ({ page }) => {
  let submissionCount = 0
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))
  await mockApiRoute(page, '/v1/invoices/42/submit-for-validation', async (route) => {
    submissionCount += 1
    expect(route.request().method()).toBe('POST')
    await fulfillJson(route, 200, { invoiceId: 42, status: 'A_VERIFIER' })
  })

  await page.goto('/invoices/42')
  await page.getByRole('button', { name: 'Request approval' }).click()

  await expect(page.getByText('Waiting approval')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request approval' })).toHaveCount(0)
  expect(submissionCount).toBe(1)
})

test('hides processing actions from the accounting manager role', async ({ page }) => {
  await mockApiRoute(page, '/v1/users/me', (route) => fulfillJson(route, 200, {
    ...currentUser,
    role: { ...currentUser.role, code: 'RESPONSABLE_COMPTABLE' },
  }))
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))

  await page.goto('/invoices/42')

  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request approval' })).toHaveCount(0)
})

test('keeps the invoice detail contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))

  await page.goto('/invoices/42')
  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction' })).toBeVisible()

  const documentWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client)
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
