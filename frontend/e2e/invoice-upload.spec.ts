import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const supportedFiles = [
  {
    name: 'invoice.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 invoice'),
  },
  {
    name: 'invoice.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    name: 'invoice.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  },
]

const inboxInvoicePage = {
  content: [
    {
      currencyCode: 'EUR',
      dueDate: '2026-09-12',
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
      invoiceDate: '2026-08-12',
      invoiceId: 41,
      invoiceNumber: 'INV-2026-0041',
      status: 'OCR_EN_COURS',
      supplierName: 'Saint-Gobain',
      totalTtc: '2340.80',
    },
    {
      currencyCode: 'EUR',
      dueDate: null,
      invoiceDate: '2026-08-11',
      invoiceId: 40,
      invoiceNumber: 'INV-2026-0040',
      status: 'ERREUR_OCR',
      supplierName: null,
      totalTtc: null,
    },
    {
      currencyCode: 'EUR',
      dueDate: null,
      invoiceDate: '2026-08-10',
      invoiceId: 39,
      invoiceNumber: 'INV-2026-0039',
      status: 'DEPOSEE',
      supplierName: 'Vinci Energies',
      totalTtc: '7815.20',
    },
  ],
  number: 0,
  size: 8,
  totalElements: 4,
  totalPages: 1,
}

async function mockInboxList(page: Page, response = inboxInvoicePage) {
  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== 'GET' || !url.pathname.endsWith('/v1/invoices')) {
      await route.fallback()
      return
    }

    await fulfillJson(route, 200, response)
  })
}

async function captureBrowserUpload(page: Page) {
  await page.addInitScript(() => {
    const originalSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.send = function send(body) {
      const browserWindow = window as Window & {
        invoiceUploadRequest?: XMLHttpRequest
      }
      browserWindow.invoiceUploadRequest = this
      originalSend.call(this, body)
    }
  })
}

async function completeBrowserUpload(page: Page) {
  await page.evaluate(() => {
    const request = (window as Window & { invoiceUploadRequest?: XMLHttpRequest })
      .invoiceUploadRequest

    if (!request) {
      throw new Error('Invoice upload request was not captured')
    }

    request.upload.dispatchEvent(
      new ProgressEvent('progress', { lengthComputable: true, loaded: 48, total: 100 }),
    )
    request.upload.dispatchEvent(new Event('load'))
  })
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockInboxList(page)
})

test('renders the Figma inbox statuses and opens a selected invoice', async ({ page }) => {
  const listRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return request.method() === 'GET' && url.pathname.endsWith('/v1/invoices')
  })

  await page.goto('/inbox')

  const requestUrl = new URL((await listRequest).url())
  expect(requestUrl.searchParams.getAll('status')).toEqual([
    'DEPOSEE',
    'OCR_EN_COURS',
    'EXTRAITE',
    'ERREUR_OCR',
  ])
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('data-state', 'active')
  await expect(page.getByRole('tab', { name: 'New' })).toBeVisible()
  await expect(page.getByRole('tab', { exact: true, name: 'Processing' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Needs review' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Processing failed' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Inbox invoice list' })).toBeVisible()
  await expect(page.getByText('Acme Supplies')).toBeVisible()
  await expect(page.getByText('OCR error')).toBeVisible()
  await expect(page.getByText('1–4 of 4 invoices')).toBeVisible()

  await page.getByRole('link', { name: 'Open invoice INV-2026-0042' }).click()
  await expect(page).toHaveURL(/\/invoices\/42$/)
})

test('filters the inbox by processing state, invoice number and supplier', async ({ page }) => {
  const requestedUrls: URL[] = []
  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== 'GET' || !url.pathname.endsWith('/v1/invoices')) {
      await route.fallback()
      return
    }

    requestedUrls.push(url)
    await fulfillJson(route, 200, inboxInvoicePage)
  })

  await page.goto('/inbox')
  await expect(page.getByText('Acme Supplies')).toBeVisible()

  await page.getByRole('tab', { name: 'Processing failed' }).click()
  await expect.poll(() => requestedUrls.at(-1)?.searchParams.getAll('status'))
    .toEqual(['ERREUR_OCR'])

  await page.getByRole('searchbox', { name: 'Search inbox' }).fill('INV-2026-0040')
  await page.getByRole('searchbox', { name: 'Search inbox' }).press('Enter')
  await expect.poll(() => requestedUrls.at(-1)?.searchParams.get('invoiceNumber'))
    .toBe('INV-2026-0040')

  await page.getByRole('button', { exact: true, name: 'Supplier' }).click()
  await page.locator('#inbox-supplier-filter').fill('Vinci')
  await page.getByRole('button', { exact: true, name: 'Apply' }).click()

  await expect.poll(() => ({
    invoiceNumber: requestedUrls.at(-1)?.searchParams.get('invoiceNumber'),
    status: requestedUrls.at(-1)?.searchParams.getAll('status'),
    supplier: requestedUrls.at(-1)?.searchParams.get('supplier'),
  })).toEqual({
    invoiceNumber: 'INV-2026-0040',
    status: ['ERREUR_OCR'],
    supplier: 'Vinci',
  })
  await expect(page).toHaveURL(/view=processing-failed/)
  await expect(page).toHaveURL(/invoiceNumber=INV-2026-0040/)
  await expect(page).toHaveURL(/supplier=Vinci/)
})

test('shows the inbox loading and filtered empty states', async ({ page }) => {
  let releaseList: () => void = () => undefined
  const listGate = new Promise<void>((resolve) => {
    releaseList = resolve
  })
  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== 'GET' || !url.pathname.endsWith('/v1/invoices')) {
      await route.fallback()
      return
    }

    await listGate
    await fulfillJson(route, 200, {
      ...inboxInvoicePage,
      content: [],
      totalElements: 0,
      totalPages: 0,
    })
  })

  await page.goto('/inbox?view=processing-failed')
  await expect(page.getByLabel('Loading inbox invoices')).toBeVisible()

  releaseList()
  await expect(page.getByRole('heading', { name: 'No matching inbox invoices' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByRole('heading', { name: 'Inbox is empty' })).toBeVisible()
})

test('keeps the inbox available while retrying a list error', async ({ page }) => {
  let requestCount = 0
  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== 'GET' || !url.pathname.endsWith('/v1/invoices')) {
      await route.fallback()
      return
    }

    requestCount += 1
    await fulfillJson(route, requestCount === 1 ? 503 : 200, requestCount === 1
      ? { message: 'Inbox unavailable' }
      : inboxInvoicePage)
  })

  await page.goto('/inbox')

  await expect(page.getByRole('heading', { exact: true, name: 'Inbox' })).toBeVisible()
  await expect(page.getByText('Unable to load inbox invoices')).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Acme Supplies')).toBeVisible()
  expect(requestCount).toBe(2)
})

test('opens the Figma upload sheet from the inbox header', async ({ page }) => {
  await page.goto('/inbox')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Upload invoices' }).click()

  const uploadSheet = page.getByRole('dialog')
  await expect(uploadSheet).toBeVisible()
  await expect(uploadSheet.getByRole('heading', { name: 'Upload invoices' })).toBeVisible()
  await expect(uploadSheet.getByText('Drop invoices here')).toBeVisible()
  await expect(uploadSheet.getByText('Empty', { exact: true })).toBeVisible()
})

test('accepts the supported invoice file formats before upload', async ({ page }) => {
  await page.goto('/invoices/upload')
  await expect(page).toHaveURL(/\/inbox\?upload=1$/)

  for (const file of supportedFiles) {
    await page.locator('#invoiceFile').setInputFiles(file)
    await expect(page.getByText(file.name, { exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
})

test('uploads an invoice without a supplier identifier', async ({ page }) => {
  let multipartBody = ''

  await mockApiRoute(page, '/v1/invoices/upload', async (route) => {
    multipartBody = route.request().postDataBuffer()?.toString('utf8') ?? ''
    await fulfillJson(route, 200, {
      invoiceId: 42,
      invoiceNumber: 'INV-2026-0042',
      status: 'EXTRAITE',
      ocrAnalysis: {
        status: 'COMPLETED',
        rawText: 'Invoice INV-2026-0042',
        confidenceScore: '0.98',
        fields: [],
      },
    })
  })

  await page.goto('/invoices/upload')
  await page.locator('#invoiceFile').setInputFiles(supportedFiles[0])
  await page.getByRole('button', { name: 'Upload 1 invoice' }).click()

  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible()
  expect(multipartBody).toContain('name="file"')
  expect(multipartBody).not.toContain('name="supplierId"')
})

test('distinguishes file upload from OCR processing', async ({ page }) => {
  await captureBrowserUpload(page)
  let releaseOcr: () => void = () => undefined
  const ocrGate = new Promise<void>((resolve) => {
    releaseOcr = resolve
  })

  await mockApiRoute(page, '/v1/invoices/upload', async (route) => {
    await ocrGate
    await fulfillJson(route, 200, {
      invoiceId: 42,
      invoiceNumber: 'INV-2026-0042',
      status: 'EXTRAITE',
      ocrAnalysis: {
        status: 'COMPLETED',
        rawText: 'Invoice INV-2026-0042',
        confidenceScore: '0.98',
        fields: [],
      },
    })
  })

  await page.goto('/invoices/upload')
  await page.locator('#invoiceFile').setInputFiles(supportedFiles[0])
  await page.getByRole('button', { name: 'Upload 1 invoice' }).click()

  await expect(page.getByText('Uploading', { exact: true }).first()).toBeVisible()
  await completeBrowserUpload(page)
  await expect(page.getByText('OCR processing', { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('OCR processing in progress')).toBeVisible()
  await expect(page.getByLabel('Preparing extracted invoice fields')).toBeVisible()

  releaseOcr()
  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible()
})

test('continues OCR after closing the sheet without uploading twice', async ({ page }) => {
  await captureBrowserUpload(page)
  let uploadRequests = 0
  let releaseOcr: () => void = () => undefined
  const ocrGate = new Promise<void>((resolve) => {
    releaseOcr = resolve
  })

  await mockApiRoute(page, '/v1/invoices/upload', async (route) => {
    uploadRequests += 1
    await ocrGate
    await fulfillJson(route, 200, {
      invoiceId: 42,
      invoiceNumber: 'INV-2026-0042',
      status: 'EXTRAITE',
      ocrAnalysis: {
        status: 'COMPLETED',
        rawText: 'Invoice INV-2026-0042',
        confidenceScore: '0.98',
        fields: [],
      },
    })
  })

  await page.goto('/inbox')
  await page.getByRole('button', { name: 'Upload invoices' }).click()
  await page.locator('#invoiceFile').setInputFiles(supportedFiles[0])
  const uploadResponse = page.waitForResponse('**/api/v1/invoices/upload')
  await page.getByRole('button', { name: 'Upload 1 invoice' }).click()
  await completeBrowserUpload(page)
  await expect(page.getByText('OCR processing', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Close upload panel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  releaseOcr()
  await uploadResponse
  await page.getByRole('button', { name: 'Upload invoices' }).click()

  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible()
  expect(uploadRequests).toBe(1)
})

test('keeps the created invoice available and retries OCR without another upload', async ({
  page,
}) => {
  let uploadRequests = 0
  let retryRequests = 0

  await mockApiRoute(page, '/v1/invoices/upload', (route) => {
    uploadRequests += 1
    return fulfillJson(route, 502, {
      invoiceId: 73,
      status: 'ERREUR_OCR',
      ocrError: {
        code: 'OCR_UNAVAILABLE',
        message: 'OCR service is unavailable',
        occurredAt: '2026-08-31T16:00:00Z',
      },
    })
  })
  await mockApiRoute(page, '/v1/invoices/73/ocr/retry', (route) => {
    retryRequests += 1
    return fulfillJson(route, 200, { invoiceId: 73, status: 'EXTRAITE' })
  })

  await page.goto('/invoices/upload')
  await page.locator('#invoiceFile').setInputFiles(supportedFiles[0])
  await page.getByRole('button', { name: 'Upload 1 invoice' }).click()

  await expect(page.getByText('OCR processing failed', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('alert')).toContainText(
    'The original file is safe as invoice #73.',
  )
  await expect(page.getByText('invoice.pdf', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Retry OCR', exact: true }).click()
  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible()
  expect(uploadRequests).toBe(1)
  expect(retryRequests).toBe(1)
})

test('rejects an unsupported type without losing the selected file', async ({ page }) => {
  let uploadRequests = 0
  await mockApiRoute(page, '/v1/invoices/upload', async (route) => {
    uploadRequests += 1
    await fulfillJson(route, 500, {})
  })

  await page.goto('/invoices/upload')
  await page.locator('#invoiceFile').setInputFiles({
    name: 'invoice.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('invoice'),
  })

  await expect(page.getByRole('alert')).toContainText(
    'Seuls les fichiers PDF, PNG, JPG et JPEG sont acceptés.',
  )
  await expect(page.getByText('invoice.txt', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Retry failed uploads' }).click()
  expect(uploadRequests).toBe(0)
})

test('rejects an oversized file without losing the selected file', async ({ page }) => {
  let uploadRequests = 0
  await mockApiRoute(page, '/v1/invoices/upload', async (route) => {
    uploadRequests += 1
    await fulfillJson(route, 500, {})
  })

  await page.goto('/invoices/upload')
  await page.locator('#invoiceFile').setInputFiles({
    name: 'large-invoice.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  })

  await expect(page.getByRole('alert')).toContainText('Le fichier ne doit pas dépasser 10 Mo.')
  await expect(page.getByText('large-invoice.pdf', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Retry failed uploads' }).click()
  expect(uploadRequests).toBe(0)
})

test('shows a backend content error without losing the selected file', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/upload', (route) =>
    fulfillJson(route, 400, {
      code: 'INVALID_INVOICE_FILE',
      message: 'File content does not match its extension',
    }),
  )

  await page.goto('/invoices/upload')
  await page.locator('#invoiceFile').setInputFiles(supportedFiles[0])
  await page.getByRole('button', { name: 'Upload 1 invoice' }).click()

  await expect(page.getByRole('alert')).toContainText(
    'Le contenu du fichier ne correspond pas à son extension.',
  )
  await expect(page.getByText('invoice.pdf', { exact: true })).toBeVisible()
})
