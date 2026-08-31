import { expect, test } from '@playwright/test'

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

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('accepts the supported invoice file formats before upload', async ({ page }) => {
  await page.goto('/invoices/upload')

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
  await page.getByRole('button', { name: 'Envoyer pour analyse' }).click()

  await expect(page.getByText('Facture #INV-2026-0042')).toBeVisible()
  expect(multipartBody).toContain('name="file"')
  expect(multipartBody).not.toContain('name="supplierId"')
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

  await page.getByRole('button', { name: 'Envoyer pour analyse' }).click()
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

  await page.getByRole('button', { name: 'Envoyer pour analyse' }).click()
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
  await page.getByRole('button', { name: 'Envoyer pour analyse' }).click()

  await expect(page.getByRole('alert')).toContainText(
    'Le contenu du fichier ne correspond pas à son extension.',
  )
  await expect(page.getByText('invoice.pdf', { exact: true })).toBeVisible()
})
