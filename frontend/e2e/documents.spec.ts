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

const emptyPage = {
  content: [],
  number: 0,
  size: 8,
  totalElements: 0,
  totalPages: 0,
}

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

  await page.goto('/documents?view=grid&invoiceNumber=leroy&status=VALIDEE&page=2')

  await expect(page.getByLabel('Document preview grid')).toBeVisible()
  await expect(page.getByAltText('Preview of INV-2026-0421')).toBeVisible()
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('size')).toBe('6')
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('page')).toBe('1')

  await page.getByRole('button', { name: 'Download document INV-2026-0421' }).click()
  await expect.poll(() => downloadRequests).toBe(1)

  await page.getByRole('button', { name: 'Table' }).click()

  await expect(page.getByRole('table')).toBeVisible()
  await expect(page).toHaveURL(/invoiceNumber=leroy/)
  await expect(page).toHaveURL(/status=VALIDEE/)
  await expect(page).toHaveURL(/page=1/)
  expect(new URL(page.url()).searchParams.has('view')).toBe(false)
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('size')).toBe('8')
})

test('sends every supported filter and keeps the view synchronized with the URL', async ({ page }) => {
  const listRequests: URL[] = []

  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const url = new URL(route.request().url())
    listRequests.push(url)
    await fulfillJson(route, 200, {
      content: documents,
      number: Number(url.searchParams.get('page')),
      size: Number(url.searchParams.get('size')),
      totalElements: 14,
      totalPages: 3,
    })
  })
  await mockApiRoute(page, '/v1/invoices/*/preview', fulfillPreview)

  await page.goto('/documents?view=grid&page=3')
  await expect(page.getByLabel('Document preview grid')).toBeVisible()

  const search = page.getByRole('searchbox', { name: 'Search documents by invoice number' })
  await search.fill('INV-2026')
  await search.press('Enter')

  await page.getByRole('button', { exact: true, name: 'Supplier' }).click()
  await page.locator('#document-supplier-filter').fill('Acme')
  await page.getByRole('button', { exact: true, name: 'Apply' }).click()

  await page.getByLabel('Filter documents by status').click()
  await page.getByRole('option', { name: 'Needs review' }).click()

  await page.getByRole('button', { exact: true, name: 'Invoice date' }).click()
  await page.locator('#document-invoice-date-filter').fill('2026-08-13')
  await page.getByRole('button', { exact: true, name: 'Apply' }).click()

  await page.getByRole('button', { exact: true, name: 'Amount' }).click()
  await page.locator('#document-min-amount').fill('500')
  await page.locator('#document-max-amount').fill('1500')
  await page.getByRole('button', { exact: true, name: 'Apply' }).click()

  await page.getByRole('button', { name: 'More filters' }).click()
  await page.locator('#document-client-filter').fill('Docomptia')
  await page.locator('#document-due-date-filter').fill('2026-09-12')
  await page.locator('#document-start-date-filter').fill('2026-08-01')
  await page.locator('#document-end-date-filter').fill('2026-08-31')
  await page.getByRole('button', { name: 'Apply filters' }).click()

  await expect.poll(() => {
    const requestUrl = listRequests.at(-1)
    return {
      client: requestUrl?.searchParams.get('client'),
      dueDate: requestUrl?.searchParams.get('dueDate'),
      endDate: requestUrl?.searchParams.get('endDate'),
      invoiceDate: requestUrl?.searchParams.get('invoiceDate'),
      invoiceNumber: requestUrl?.searchParams.get('invoiceNumber'),
      maxAmount: requestUrl?.searchParams.get('maxAmount'),
      minAmount: requestUrl?.searchParams.get('minAmount'),
      page: requestUrl?.searchParams.get('page'),
      size: requestUrl?.searchParams.get('size'),
      startDate: requestUrl?.searchParams.get('startDate'),
      status: requestUrl?.searchParams.getAll('status'),
      supplier: requestUrl?.searchParams.get('supplier'),
    }
  }).toEqual({
    client: 'Docomptia',
    dueDate: '2026-09-12',
    endDate: '2026-08-31',
    invoiceDate: '2026-08-13',
    invoiceNumber: 'INV-2026',
    maxAmount: '1500',
    minAmount: '500',
    page: '0',
    size: '6',
    startDate: '2026-08-01',
    status: ['EXTRAITE'],
    supplier: 'Acme',
  })

  const currentUrl = new URL(page.url())
  expect(currentUrl.searchParams.get('view')).toBe('grid')
  expect(currentUrl.searchParams.get('page')).toBe('1')
  await expect(page.getByRole('button', { name: 'Project / Site' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Export date' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'User' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Tags' })).toBeDisabled()
})

test('distinguishes no search results from an empty document library', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, emptyPage))

  await page.goto('/documents?view=grid&invoiceNumber=missing&status=VALIDEE&page=4')

  await expect(page.getByText('No results', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No documents found' })).toBeVisible()
  await expect(page.getByText('Try adjusting your search or filters.')).toBeVisible()

  await page.getByRole('button', { name: 'Clear filters' }).click()

  await expect(page.getByRole('heading', { name: 'No documents yet' })).toBeVisible()
  await expect(page.getByText('No documents', { exact: true })).toBeVisible()
  const currentUrl = new URL(page.url())
  expect(currentUrl.searchParams.get('view')).toBe('grid')
  expect(currentUrl.searchParams.get('page')).toBe('1')
  expect(currentUrl.searchParams.has('invoiceNumber')).toBe(false)
  expect(currentUrl.searchParams.has('status')).toBe(false)
})

test('renders the Figma loading skeleton before the document response', async ({ page }) => {
  let releaseResponse: (() => void) | undefined
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })

  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    await responseGate
    await fulfillJson(route, 200, {
      ...emptyPage,
      content: documents,
      totalElements: documents.length,
      totalPages: 1,
    })
  })

  await page.goto('/documents')

  await expect(page.getByLabel('Loading documents')).toBeVisible()
  await expect(page.getByLabel('Document filters')).toHaveCount(0)

  releaseResponse?.()

  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByLabel('Loading documents')).toHaveCount(0)
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
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, emptyPage))

  await page.goto('/documents')

  await expect(page.getByRole('heading', { name: 'No documents yet' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to inbox' })).toHaveAttribute(
    'href',
    '/inbox?upload=1',
  )
})

for (const view of ['table', 'grid']) {
  test(`identifies archived documents as read-only in ${view} view`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: view === 'table' ? 1440 : 390, height: 1024 })
    await mockApiRoute(page, '/v1/invoices*', async (route) => {
      const url = new URL(route.request().url())
      expect(route.request().method()).toBe('GET')
      expect(url.searchParams.getAll('status')).toEqual(['ARCHIVEE'])
      expect(url.searchParams.get('invoiceNumber')).toBe('INV-2026')
      await fulfillJson(route, 200, {
        ...emptyPage, content: [documents[0]], totalElements: 1, totalPages: 1,
      })
    })
    await mockApiRoute(page, '/v1/invoices/42/preview', fulfillPreview)
    await page.goto(`/documents?view=${view}&status=ARCHIVEE&invoiceNumber=INV-2026`)

    const notice = page.getByRole('status', { name: 'Archived document notice' })
    await expect(notice).toContainText('Archived — read only')
    const results = view === 'table' ? page.getByRole('table') : page.getByLabel('Document preview grid')
    await expect(results.getByText('Archived — read only', { exact: true })).toBeVisible()
    await expect(results.getByRole('button', { name: /Edit|Delete|Approve|Reject/ })).toHaveCount(0)
    const open = page.getByRole('link', { name: 'Open document INV-2026-0421' })
    await expect(open).toHaveAttribute('href', '/invoices/42')
    await expect(page.getByRole('button', { name: 'Download document INV-2026-0421' })).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`archived-${view}.png`), fullPage: true })

    await open.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/invoices\/42$/)
    await page.goBack()
    await expect(page).toHaveURL(/status=ARCHIVEE&invoiceNumber=INV-2026/)
    await expect(notice).toBeVisible()
  })
}

test('only shows the archived notice when returned results contain archives', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, {
    ...emptyPage, content: [documents[1]], totalElements: 1, totalPages: 1,
  }))
  await page.goto('/documents')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('status', { name: 'Archived document notice' })).toHaveCount(0)
})

test('respects denied archived previews and downloads without a public URL fallback', async ({ page }) => {
  let downloads = 0
  page.on('download', () => { downloads += 1 })
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, {
    ...emptyPage, content: [documents[0]], totalElements: 1, totalPages: 1,
  }))
  for (const endpoint of ['preview', 'file']) {
    await mockApiRoute(page, `/v1/invoices/42/${endpoint}`, async (route) => {
      expect(route.request().method()).toBe('GET')
      expect(route.request().headers().authorization).toBe('Bearer e2e-token')
      await fulfillJson(route, 403, { code: 'ACCESS_DENIED' })
    })
  }
  await page.goto('/documents?view=grid&status=ARCHIVEE')
  await expect(page.getByText('You do not have permission to preview this document.')).toBeVisible()
  const download = page.getByRole('button', { name: 'Download document INV-2026-0421' })
  await download.click()
  await expect(page.getByText('You do not have permission to download this document.')).toBeVisible()
  await expect(download).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Open document INV-2026-0421' })).toBeVisible()
  await expect(page.locator('object, img[alt^="Preview of"]')).toHaveCount(0)
  expect(downloads).toBe(0)
})

test('waits for the protected archived file and allows retry after download failure', async ({ page }) => {
  let attempts = 0
  let releaseFile!: () => void
  const fileResponse = new Promise<void>((resolve) => { releaseFile = resolve })
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, {
    ...emptyPage, content: [documents[0]], totalElements: 1, totalPages: 1,
  }))
  await mockApiRoute(page, '/v1/invoices/42/file', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    attempts += 1
    if (attempts === 1) {
      await fulfillJson(route, 503, {})
      return
    }
    await fileResponse
    await route.fulfill({
      body: transparentPng, contentType: 'image/png', headers: fileHeaders, status: 200,
    })
  })
  await page.goto('/documents?status=ARCHIVEE')
  const button = page.getByRole('button', { name: 'Download document INV-2026-0421' })
  await button.click()
  await expect(page.getByText('Download unavailable')).toBeVisible()
  await expect(button).toBeEnabled()
  await button.click()
  await expect(button).toBeDisabled()
  await expect(button).toContainText('Downloading…')
  const downloadPromise = page.waitForEvent('download')
  releaseFile()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('INV-2026-0421.png')
  await expect(button).toBeEnabled()
  await expect(page.getByText('Download unavailable')).toHaveCount(0)
})
