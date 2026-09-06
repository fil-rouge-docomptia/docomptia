import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

import {
  currentUser,
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
} from './support/api'

const validator = {
  ...currentUser,
  role: {
    code: 'RESPONSABLE_COMPTABLE',
    id: 3,
    label: 'Accounting manager',
  },
}

const approvalPage = {
  content: [
    {
      currencyCode: 'EUR',
      dueDate: '2026-08-30',
      invoiceDate: '2026-08-13',
      invoiceId: 42,
      invoiceNumber: 'INV-2026-0042',
      status: 'A_VERIFIER',
      supplierName: 'Acme Supplies',
      totalTtc: '1250.50',
    },
    {
      currencyCode: 'EUR',
      dueDate: '2026-09-12',
      invoiceDate: '2026-08-19',
      invoiceId: 43,
      invoiceNumber: 'INV-2026-0043',
      status: 'A_VERIFIER',
      supplierName: 'Bati Services',
      totalTtc: '2500.00',
    },
  ],
  number: 0,
  size: 8,
  totalElements: 10,
  totalPages: 2,
}

const emptyApprovalPage = {
  content: [],
  number: 0,
  size: 8,
  totalElements: 0,
  totalPages: 0,
}

const approvalDetails = {
  accountingEntry: null,
  classification: null,
  commandReference: 'PO-2026-0042',
  currencyCode: 'EUR',
  dueDate: '2026-09-12',
  duplicateAlerts: [],
  filePath: '/invoices/Acme Supplies - INV-2026-0042.svg',
  invoiceDate: '2026-08-13',
  invoiceId: 42,
  invoiceNumber: 'INV-2026-0042',
  ocrAnalysis: {
    confidenceScore: '0.94',
    engineName: 'mock-ocr',
    engineVersion: '1.0',
    fields: [],
    rawText: 'Invoice INV-2026-0042',
    status: 'SUCCESS',
  },
  ocrError: null,
  status: 'A_VERIFIER',
  supplier: {
    confirmed: true,
    currentCountryCode: 'FR',
    currentLegalName: 'Acme Supplies SAS',
    currentTradeName: 'Acme Supplies',
    snapshotAddress: '12 rue des Fournisseurs, 75011 Paris',
    snapshotIdentifiers: 'SIRET 12345678900012',
    snapshotLegalName: 'Acme Supplies SAS',
    supplierId: 12,
  },
  supplierName: 'Acme Supplies',
  totalHt: '1250.50',
  totalTtc: '1500.60',
  totalTva: '250.10',
}

async function fulfillOriginalInvoiceImage(route: Route) {
  await route.fulfill({
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/><text x="40" y="80">INV-2026-0042</text></svg>',
    contentType: 'image/svg+xml',
    headers: {
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-allow-origin': '*',
    },
    status: 200,
  })
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page, validator)
})

test('opens focus review and restores the approval queue context', async ({ page }) => {
  const requestedUrls: URL[] = []
  const secondApprovalPage = { ...approvalPage, number: 1 }

  await mockApiRoute(page, '/v1/invoices/pending-validation*', async (route) => {
    requestedUrls.push(new URL(route.request().url()))
    await fulfillJson(route, 200, secondApprovalPage)
  })
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, approvalDetails)
  ))
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoiceImage)

  await page.goto('/approvals?page=2&sortBy=totalTtc&direction=DESC')

  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible()
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible()
  await expect(page.getByText('Waiting approval').first()).toBeVisible()
  await expect(page.getByText('9–10 of 10 invoices')).toBeVisible()
  await expect(page.getByText('€3,750.50')).toBeVisible()

  const initialRequest = requestedUrls.at(-1)
  expect(initialRequest?.pathname).toBe('/api/v1/invoices/pending-validation')
  expect(initialRequest?.searchParams.get('page')).toBe('1')
  expect(initialRequest?.searchParams.get('size')).toBe('8')
  expect(initialRequest?.searchParams.get('sortBy')).toBe('totalTtc')
  expect(initialRequest?.searchParams.get('direction')).toBe('DESC')
  expect(initialRequest?.searchParams.has('status')).toBe(false)

  await page.getByRole('link', { name: 'Open invoice INV-2026-0042' }).click()

  await expect(page).toHaveURL(/\/approvals\/42\?/)
  await expect(page.getByRole('heading', { name: 'Approval review' })).toBeVisible()
  await expect(page.getByText('Invoice 9 of 10')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Original invoice document' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Invoice summary' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Accounting context' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Decision' })).toBeVisible()
  await expect(page.getByText('Ready for decision')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve invoice' })).toBeDisabled()

  await page.getByRole('link', { name: 'Back to approvals' }).click()
  await expect(page).toHaveURL('/approvals?page=2&sortBy=totalTtc&direction=DESC')
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible()
})

test('blocks decisions when required invoice data is missing', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
    ...approvalDetails,
    invoiceNumber: null,
    supplier: null,
    totalHt: null,
    totalTtc: null,
    totalTva: null,
  }))
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoiceImage)

  await page.goto('/approvals/42')

  await expect(page.getByRole('heading', { name: 'Approval review' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Decision blocked')
  await expect(page.getByRole('alert')).toContainText('The supplier is missing.')
  await expect(page.getByRole('alert')).toContainText('The invoice number is missing.')
  await expect(page.getByRole('alert')).toContainText('The invoice amounts are incomplete.')
  await expect(page.getByRole('button', { name: 'Approve invoice' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Request correction' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Reject invoice' })).toBeDisabled()
})

test('keeps approval sorting and pagination in the URL', async ({ page }) => {
  const requestedUrls: URL[] = []

  await mockApiRoute(page, '/v1/invoices/pending-validation*', async (route) => {
    requestedUrls.push(new URL(route.request().url()))
    await fulfillJson(route, 200, approvalPage)
  })

  await page.goto('/approvals')
  await expect(page.getByText('Acme Supplies')).toBeVisible()

  await page.getByRole('button', { name: 'Total' }).click()
  await expect(page).toHaveURL(/sortBy=totalTtc/)
  await expect.poll(() => requestedUrls.at(-1)?.searchParams.get('sortBy')).toBe('totalTtc')
  expect(requestedUrls.at(-1)?.searchParams.get('direction')).toBe('ASC')

  await page.getByRole('button', { name: 'Page 2' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(() => requestedUrls.at(-1)?.searchParams.get('page')).toBe('1')
})

test('shows the dedicated empty state when no validation is required', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/pending-validation*', (route) => (
    fulfillJson(route, 200, emptyApprovalPage)
  ))

  await page.goto('/approvals')

  await expect(page.getByRole('heading', { name: 'No approvals waiting' })).toBeVisible()
  await expect(page.getByText('Invoices submitted for validation will appear here.')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('lets the validator retry after an approval queue error', async ({ page }) => {
  let requestCount = 0

  await mockApiRoute(page, '/v1/invoices/pending-validation*', async (route) => {
    requestCount += 1
    await fulfillJson(route, requestCount === 1 ? 500 : 200, requestCount === 1
      ? { code: 'INTERNAL_ERROR', message: 'Unavailable' }
      : approvalPage)
  })

  await page.goto('/approvals')

  await expect(page.getByRole('alert')).toContainText('Unable to load approvals')
  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(page.getByText('Acme Supplies')).toBeVisible()
  expect(requestCount).toBe(2)
})
