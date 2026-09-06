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
  await expect(page.getByText('Acme Supplies')).toBeVisible()
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
  await expect(page.getByText('Acme Supplies')).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Request changes' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Reject invoice' })).toBeDisabled()
})

test('rejects an invoice after backend confirmation and shows the persisted reason', async ({ page }) => {
  let releaseRejection: () => void = () => undefined
  const rejectionPending = new Promise<void>((resolve) => {
    releaseRejection = resolve
  })
  let rejectionRequest: { method: string; payload: unknown } | null = null

  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, approvalDetails)
  ))
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoiceImage)
  await mockApiRoute(page, '/v1/invoices/42/reject', async (route) => {
    rejectionRequest = {
      method: route.request().method(),
      payload: route.request().postDataJSON(),
    }
    await rejectionPending
    await fulfillJson(route, 200, { invoiceId: 42, status: 'REJETEE' })
  })

  await page.goto('/approvals/42')
  await expect(page.getByText('Ready for decision')).toBeVisible()
  await page.keyboard.press('r')

  const dialog = page.getByRole('dialog', { name: 'Reject invoice' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio', { name: 'Incorrect amount' })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Wrong supplier' }).check()
  await dialog.getByLabel('Comment').fill('Supplier identity does not match.')
  await dialog.getByRole('button', { name: 'Reject invoice', exact: true }).click()

  await expect(dialog.getByRole('button', { name: 'Rejecting…' })).toBeDisabled()
  await expect(page.getByText('Invoice rejected')).toHaveCount(0)

  releaseRejection()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Invoice rejected')).toBeVisible()
  await expect(page.getByText('Rejected', { exact: true })).toBeVisible()
  await expect(page.getByText('Wrong supplier: Supplier identity does not match.')).toBeVisible()
  expect(rejectionRequest).toEqual({
    method: 'POST',
    payload: { reason: 'Wrong supplier: Supplier identity does not match.' },
  })
})

test('keeps the rejection form values when the backend rejects the request', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, approvalDetails)
  ))
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoiceImage)
  await mockApiRoute(page, '/v1/invoices/42/reject', (route) => (
    fulfillJson(route, 500, { code: 'INTERNAL_ERROR', message: 'Unavailable' })
  ))

  await page.goto('/approvals/42')
  await page.getByRole('button', { name: 'Reject invoice' }).click()

  const dialog = page.getByRole('dialog', { name: 'Reject invoice' })
  await dialog.getByRole('radio', { name: 'Other' }).check()
  await dialog.getByLabel('Comment').fill('The document belongs to another organization.')
  await dialog.getByRole('button', { name: 'Reject invoice', exact: true }).click()

  await expect(dialog.getByRole('alert')).toContainText(
    'Unable to reject the invoice. Your reason and comment have been kept.',
  )
  await expect(dialog.getByRole('radio', { name: 'Other' })).toBeChecked()
  await expect(dialog.getByLabel('Comment')).toHaveValue(
    'The document belongs to another organization.',
  )
  await expect(page.getByText('Waiting approval')).toBeVisible()
})

test('loads the recorded rejection reason for an already rejected invoice', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
    ...approvalDetails,
    status: 'REJETEE',
  }))
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoiceImage)
  await mockApiRoute(page, '/v1/invoices/42/history', (route) => fulfillJson(route, 200, [
    {
      action: 'REJECTION',
      author: 'Marie Laurent',
      authorId: 3,
      comment: 'Incorrect amount: The VAT amount is incorrect.',
      date: '2026-08-20T10:15:00',
      duplicateAlertId: null,
      fieldName: null,
      newValue: null,
      oldValue: null,
      type: 'VALIDATION_DECISION',
    },
  ]))

  await page.goto('/approvals/42')

  await expect(page.getByText('Invoice rejected')).toBeVisible()
  await expect(page.getByText('Rejected', { exact: true })).toBeVisible()
  await expect(page.getByText('Incorrect amount: The VAT amount is incorrect.')).toBeVisible()
})

test('requests invoice changes after backend confirmation and leaves the approval queue', async ({ page }) => {
  let releaseCorrectionRequest: () => void = () => undefined
  const correctionRequestPending = new Promise<void>((resolve) => {
    releaseCorrectionRequest = resolve
  })
  let correctionRequest: { method: string; payload: unknown } | null = null

  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, approvalDetails)
  ))
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoiceImage)
  await mockApiRoute(page, '/v1/invoices/42/request-correction', async (route) => {
    correctionRequest = {
      method: route.request().method(),
      payload: route.request().postDataJSON(),
    }
    await correctionRequestPending
    await fulfillJson(route, 200, { invoiceId: 42, status: 'EXTRAITE' })
  })
  await mockApiRoute(page, '/v1/invoices/pending-validation*', (route) => (
    fulfillJson(route, 200, emptyApprovalPage)
  ))

  await page.goto('/approvals/42')
  await expect(page.getByText('Ready for decision')).toBeVisible()
  await page.keyboard.press('c')

  const dialog = page.getByRole('dialog', { name: 'Request changes' })
  const submitButton = dialog.getByRole('button', { name: 'Send request' })
  await expect(dialog).toBeVisible()
  await expect(submitButton).toBeDisabled()

  await dialog.getByLabel('Correction instructions').fill(
    '  Check the VAT amount and attach the missing purchase order.  ',
  )
  await submitButton.click()

  await expect(dialog.getByRole('button', { name: 'Sending…' })).toBeDisabled()
  await expect(page.getByText('Changes requested')).toHaveCount(0)

  releaseCorrectionRequest()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Changes requested')).toBeVisible()
  await expect(page.getByText('Needs review', { exact: true })).toBeVisible()
  await expect(page.getByText(
    'Check the VAT amount and attach the missing purchase order.',
  )).toBeVisible()
  expect(correctionRequest).toEqual({
    method: 'POST',
    payload: { reason: 'Check the VAT amount and attach the missing purchase order.' },
  })

  await page.getByRole('link', { name: 'Back to approvals' }).click()
  await expect(page.getByRole('heading', { name: 'No approvals waiting' })).toBeVisible()
})

test('keeps correction instructions when the backend rejects the request', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, approvalDetails)
  ))
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoiceImage)
  await mockApiRoute(page, '/v1/invoices/42/request-correction', (route) => (
    fulfillJson(route, 500, { code: 'INTERNAL_ERROR', message: 'Unavailable' })
  ))

  await page.goto('/approvals/42')
  await page.getByRole('button', { name: 'Request changes' }).click()

  const dialog = page.getByRole('dialog', { name: 'Request changes' })
  const instructions = 'Confirm the due date with the supplier.'
  await dialog.getByLabel('Correction instructions').fill(instructions)
  await dialog.getByRole('button', { name: 'Send request' }).click()

  await expect(dialog.getByRole('alert')).toContainText(
    'Unable to request changes. Your instructions have been kept.',
  )
  await expect(dialog.getByLabel('Correction instructions')).toHaveValue(instructions)
  await expect(page.getByText('Waiting approval')).toBeVisible()
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
