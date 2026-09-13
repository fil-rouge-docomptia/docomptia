import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'
import type { InvoiceHistoryItem } from '../src/types/invoice'

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

const invoiceHistory: InvoiceHistoryItem[] = [
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
  history: invoiceHistory,
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
  supplier: {
    confirmed: true,
    currentCountryCode: 'FR',
    currentLegalName: 'Leroy Construction SAS',
    currentTradeName: 'Leroy Construction',
    snapshotAddress: '12 rue des Ateliers, 75011 Paris',
    snapshotIdentifiers: 'SIRET 12345678900012, VAT FR12123456789',
    snapshotLegalName: 'Leroy Construction SAS',
    supplierId: 42,
  },
  supplierName: 'Leroy Construction',
  totalHt: '1250.50',
  totalTtc: '1500.60',
  totalTva: '250.10',
}

const balancedAccountingEntry = {
  version: 0,
  accountingEntryId: 15,
  balanceDifference: '0.00',
  balanced: true,
  entryDate: '2026-08-13',
  entryNumber: 'ACC-2026-0421',
  label: 'Leroy Construction — INV-2026-0421',
  lines: [
    {
      accountLabel: 'Supplies',
      accountNumber: '606300',
      accountingEntryLineId: 151,
      creditAmount: '0.00',
      debitAmount: '1000.00',
      lineLabel: 'Supplies',
      lineNumber: 1,
    },
    {
      accountLabel: 'Deductible VAT',
      accountNumber: '445660',
      accountingEntryLineId: 152,
      creditAmount: '0.00',
      debitAmount: '260.00',
      lineLabel: 'Deductible VAT',
      lineNumber: 2,
    },
    {
      accountLabel: 'Supplier',
      accountNumber: '401000',
      accountingEntryLineId: 153,
      creditAmount: '1260.00',
      debitAmount: '0.00',
      lineLabel: 'Supplier',
      lineNumber: 3,
    },
  ],
  status: 'GENERATED',
  totalCredit: '1260.00',
  totalDebit: '1260.00',
}

const balancedInvoiceDetails = {
  ...invoiceDetails,
  accountingEntry: balancedAccountingEntry,
  status: 'VALIDEE',
}

const unbalancedInvoiceDetails = {
  ...invoiceDetails,
  accountingEntry: {
    ...balancedAccountingEntry,
    balanceDifference: '60.00',
    balanced: false,
    lines: balancedAccountingEntry.lines.map((line) => (
      line.accountNumber === '401000'
        ? { ...line, creditAmount: '1200.00' }
        : line
    )),
    status: 'GENERATED',
    totalCredit: '1200.00',
  },
  status: 'VALIDEE',
}

const chartOfAccountsPage = {
  content: [
    {
      accountId: 4,
      accountLabel: 'Supplies',
      accountNumber: '606300',
      accountType: 'EXPENSE',
      active: true,
    },
    {
      accountId: 3,
      accountLabel: 'Deductible VAT',
      accountNumber: '445660',
      accountType: 'VAT',
      active: true,
    },
    {
      accountId: 1,
      accountLabel: 'Supplier',
      accountNumber: '401000',
      accountType: 'SUPPLIER',
      active: true,
    },
    {
      accountId: 2,
      accountLabel: 'Purchases',
      accountNumber: '607000',
      accountType: 'EXPENSE',
      active: true,
    },
  ],
  number: 0,
  size: 100,
  totalElements: 4,
  totalPages: 1,
}

const supplierOptionsPage = {
  content: [
    {
      countryCode: 'FR',
      currentLegalIdentifiers: [{
        countryCode: 'FR',
        scheme: 'FR_SIRET',
        validTo: null,
        value: '12345678900012',
      }],
      legalName: 'Leroy Construction SAS',
      name: 'Leroy Construction',
      siret: '12345678900012',
      supplierId: 42,
      tradeName: 'Leroy Construction',
      vatNumber: 'FR12123456789',
    },
    {
      countryCode: 'FR',
      currentLegalIdentifiers: [
        {
          countryCode: 'FR',
          scheme: 'FR_SIRET',
          validTo: null,
          value: '55210055400013',
        },
        {
          countryCode: 'FR',
          scheme: 'EU_VAT',
          validTo: null,
          value: 'FR78552100554',
        },
      ],
      legalName: 'Vinci Energies France SAS',
      name: 'Vinci Energies',
      siret: '55210055400013',
      supplierId: 84,
      tradeName: 'Vinci Energies',
      vatNumber: 'FR78552100554',
    },
  ],
  number: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
}

const reassignedInvoiceDetails = {
  ...invoiceDetails,
  supplier: {
    confirmed: true,
    currentCountryCode: 'FR',
    currentLegalName: 'Vinci Energies France SAS',
    currentTradeName: 'Vinci Energies',
    snapshotAddress: '2169 boulevard de la Défense, 92000 Nanterre',
    snapshotIdentifiers: 'SIRET 55210055400013, VAT FR78552100554',
    snapshotLegalName: 'Vinci Energies France SAS',
    supplierId: 84,
  },
  supplierName: 'Vinci Energies',
}

const approvalHistory = [
  {
    action: 'DEPOSEE',
    author: 'Alex Martin',
    authorId: 1,
    comment: 'Invoice uploaded',
    date: '2026-08-12T14:28:00',
    duplicateAlertId: null,
    fieldName: null,
    newValue: null,
    oldValue: null,
    type: 'STATUS_CHANGE',
  },
  {
    action: 'EXTRAITE',
    author: 'Alex Martin',
    authorId: 1,
    comment: 'OCR analysis completed',
    date: '2026-08-12T16:18:00',
    duplicateAlertId: null,
    fieldName: null,
    newValue: null,
    oldValue: null,
    type: 'STATUS_CHANGE',
  },
  {
    action: 'A_VERIFIER',
    author: 'Alex Martin',
    authorId: 1,
    comment: 'Invoice submitted for validation',
    date: '2026-08-13T09:15:00',
    duplicateAlertId: null,
    fieldName: null,
    newValue: null,
    oldValue: null,
    type: 'STATUS_CHANGE',
  },
]

const waitingApprovalDetails = {
  ...invoiceDetails,
  status: 'A_VERIFIER',
}

const rejectedInvoiceDetails = {
  ...invoiceDetails,
  status: 'REJETEE',
}

const rejectionHistory = [
  ...approvalHistory,
  {
    action: 'REJETEE',
    author: 'Marie Laurent',
    authorId: 8,
    comment: 'Incorrect amount: VAT total does not match the document.',
    date: '2026-08-13T11:42:00',
    duplicateAlertId: null,
    fieldName: null,
    newValue: null,
    oldValue: null,
    type: 'STATUS_CHANGE',
  },
  {
    action: 'REJECTION',
    author: 'Marie Laurent',
    authorId: 8,
    comment: 'Incorrect amount: VAT total does not match the document.',
    date: '2026-08-13T11:42:00',
    duplicateAlertId: null,
    fieldName: null,
    newValue: null,
    oldValue: null,
    type: 'VALIDATION_DECISION',
  },
]

const pendingDuplicateAlert = {
  alertId: 71,
  confidenceLevel: 'PROBABLE',
  createdAt: '2026-08-13T10:31:00',
  decidedAt: null,
  decidedByUserId: null,
  decision: 'PENDING',
  decisionReason: null,
  invoiceDate: '2026-08-13',
  matchingInvoiceId: 39,
  matchingInvoiceNumber: 'INV-2026-0398',
  supplierId: 12,
  totalTtc: '1500.60',
  type: 'PROBABLE',
}

const duplicateInvoiceDetails = {
  ...invoiceDetails,
  duplicateAlerts: [pendingDuplicateAlert],
}

const matchingInvoiceDetails = {
  ...invoiceDetails,
  dueDate: '2026-09-10',
  filePath: '/invoices/Leroy Construction — INV-2026-0398.pdf',
  invoiceId: 39,
  invoiceNumber: 'INV-2026-0398',
}

function duplicateDecisionDetails(
  decision: 'CONFIRM' | 'IGNORE' | 'REJECT',
  status: 'A_VERIFIER' | 'REJETEE',
  reason: string | null = null,
) {
  return {
    ...duplicateInvoiceDetails,
    duplicateAlerts: [{
      ...pendingDuplicateAlert,
      decidedAt: '2026-09-01T11:45:00',
      decidedByUserId: 1,
      decision,
      decisionReason: reason,
    }],
    status,
  }
}

const correctedInvoiceDetails = {
  ...invoiceDetails,
  history: [
    ...invoiceHistory,
    {
      ...invoiceHistory[0],
      action: 'FIELD_CORRECTION',
      comment: null,
      date: '2026-08-13T11:32:00',
      fieldName: 'totalTva',
      newValue: '260.10',
      oldValue: '250.10',
      type: 'CORRECTION',
    },
  ],
  ocrAnalysis: {
    ...invoiceDetails.ocrAnalysis,
    fields: invoiceDetails.ocrAnalysis.fields.map((field) => (
      field.fieldName === 'totalTva'
        ? {
            ...field,
            corrected: true,
            normalizedValue: '260.10',
          }
        : field
    )),
  },
  totalTva: '260.10',
}

const retryableOcrFailureDetails = {
  ...invoiceDetails,
  ocrAnalysis: null,
  ocrError: {
    code: 'OCR_SERVICE_UNAVAILABLE',
    message: 'OCR service is temporarily unavailable',
    occurredAt: '2026-08-31T16:00:00',
  },
  status: 'ERREUR_OCR',
}

const nonRetryableOcrFailureDetails = {
  ...retryableOcrFailureDetails,
  ocrError: {
    code: 'OCR_SERVICE_REJECTED',
    message: 'The OCR service rejected this document',
    occurredAt: '2026-08-31T16:05:00',
  },
}

const originalInvoicePdfBase64 = [
  'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoK',
  'PDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUiA0IDAgUl0gL0NvdW50IDIgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUg',
  'L1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA3',
  'IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAg',
  'UiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA3IDAgUiA+PiA+PiAvQ29udGVu',
  'dHMgNiAwIFIgPj4KZW5kb2JqCjUgMCBvYmoKPDwgL0xlbmd0aCA3MiA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcyIDcwMCBU',
  'ZCAoT3JpZ2luYWwgaW52b2ljZSAtIHBhZ2UgMSkgVGogMCAtNDAgVGQgL0YxIDE0IFRmIChJTlYtMjAyNi0wNDIxKSBUaiBF',
  'VAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwgL0xlbmd0aCA3MiA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcyIDcwMCBU',
  'ZCAoT3JpZ2luYWwgaW52b2ljZSAtIHBhZ2UgMikgVGogMCAtNDAgVGQgL0YxIDE0IFRmIChUaGFuayB5b3UpIFRqIEVUCmVu',
  'ZHN0cmVhbQplbmRvYmoKNyAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRp',
  'Y2EgPj4KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0',
  'IDAwMDAwIG4gCjAwMDAwMDAxMjcgMDAwMDAgbiAKMDAwMDAwMDI1MyAwMDAwMCBuIAowMDAwMDAwMzc5IDAwMDAwIG4gCjAw',
  'MDAwMDA1MjMgMDAwMDAgbiAKMDAwMDAwMDY2MyAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDggL1Jvb3QgMSAwIFIgPj4K',
  'c3RhcnR4cmVmCjczMwolJUVPRgo=',
].join('')

async function fulfillOriginalInvoicePdf(route: Route) {
  await route.fulfill({
    body: Buffer.from(originalInvoicePdfBase64, 'base64'),
    contentType: 'application/pdf',
    headers: {
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-allow-origin': '*',
      'content-disposition': 'attachment; filename="Leroy Construction — INV-2026-0421.pdf"',
    },
    status: 200,
  })
}

test.beforeEach(async ({ page }) => {
  await mockApiRoute(page, '/v1/classifications*', (route) => fulfillJson(route, 200, { content: [], totalPages: 1, number: 0, size: 100, totalElements: 0 }))
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoicePdf)
})

test('renders the paginated API data and opens the selected invoice', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, firstPage))
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))
  await mockApiRoute(page, '/v1/invoices/42/file', fulfillOriginalInvoicePdf)

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

test('combines supported invoice filters and exposes active filters', async ({ page }) => {
  const requestedUrls: URL[] = []

  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    requestedUrls.push(new URL(route.request().url()))
    await fulfillJson(route, 200, firstPage)
  })

  await page.goto('/invoices')
  await expect(page.getByText('Acme Supplies')).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search invoices' }).fill('INV-2026')
  await page.getByRole('searchbox', { name: 'Search invoices' }).press('Enter')

  await page.getByLabel('Filter by status').click()
  await page.getByRole('option', { name: 'Needs review' }).click()

  await page.getByRole('button', { exact: true, name: 'Supplier' }).click()
  await page.locator('#invoice-supplier-filter').fill('Acme')
  await page.getByRole('button', { exact: true, name: 'Apply' }).click()

  await page.getByRole('button', { name: 'More filters' }).click()
  await expect(page.getByRole('heading', { name: 'Advanced filters' })).toBeVisible()
  await expect(page.locator('#invoice-ocr-confidence-filter')).toBeDisabled()
  await expect(page.locator('#invoice-export-status-filter')).toBeDisabled()
  await expect(page.locator('#invoice-category-filter')).toBeDisabled()
  await page.locator('#invoice-due-date-filter').fill('2026-09-12')
  await page.locator('#invoice-amount-filter').click()
  await page.getByRole('option', { name: '€500 to €1,000' }).click()
  await page.getByRole('button', { name: 'Apply filters' }).click()

  await expect.poll(() => {
    const requestUrl = requestedUrls.at(-1)
    return {
      category: requestUrl?.searchParams.get('category'),
      dueDate: requestUrl?.searchParams.get('dueDate'),
      exportStatus: requestUrl?.searchParams.get('exportStatus'),
      invoiceNumber: requestUrl?.searchParams.get('invoiceNumber'),
      maxAmount: requestUrl?.searchParams.get('maxAmount'),
      minAmount: requestUrl?.searchParams.get('minAmount'),
      ocrConfidence: requestUrl?.searchParams.get('ocrConfidence'),
      status: requestUrl?.searchParams.getAll('status'),
      supplier: requestUrl?.searchParams.get('supplier'),
    }
  }).toEqual({
    category: null,
    dueDate: '2026-09-12',
    exportStatus: null,
    invoiceNumber: 'INV-2026',
    maxAmount: '1000',
    minAmount: '500',
    ocrConfidence: null,
    status: ['EXTRAITE'],
    supplier: 'Acme',
  })

  await expect(page.getByRole('button', { name: 'Remove Invoice: INV-2026' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Status: Needs review' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Supplier: Acme' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Due date: 12 Sept 2026' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Remove Amount:/ })).toBeVisible()

  await page.getByRole('button', { name: 'Clear all' }).click()

  await expect.poll(() => {
    const requestUrl = requestedUrls.at(-1)
    return ['invoiceNumber', 'status', 'supplier', 'dueDate', 'minAmount', 'maxAmount']
      .every((key) => !requestUrl?.searchParams.has(key))
  }).toBe(true)
  await expect(page.getByLabel('Active invoice filters')).toHaveCount(0)
})

test('renders the invoice review sections from the detail endpoint', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))

  await page.goto('/invoices/42')

  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction' })).toBeVisible()
  await expect(page.getByText('Leroy Construction — INV-2026-0421.pdf')).toBeVisible()
  await expect(page.getByLabel('Original invoice document')).toBeVisible()
  await expect(page.getByText('1 field requires review')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Supplier' })).toContainText(
    'Leroy Construction SAS',
  )
  await expect(page.getByLabel('Total', { exact: true })).toHaveValue('1500.60')
  await expect(page.getByText('Low confidence · 82%')).toBeVisible()

  await page.getByRole('tab', { name: 'Accounting' }).click()
  await expect(page.getByRole('heading', { name: 'No accounting entry yet' })).toBeVisible()

  await page.getByRole('tab', { name: 'Approval' }).click()
  await expect(page.getByText('Review the extracted fields, then request approval')).toBeVisible()

  await page.getByRole('tab', { name: 'Activity' }).click()
  await page.getByRole('button', { name: 'View details: OCR extraction completed' }).click()
  await expect(page.getByText('OCR analysis completed')).toBeVisible()
})

test('presents API lifecycle states with explicit next-step guidance', async ({ page }) => {
  let currentInvoice = invoiceDetails
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, currentInvoice)
  ))

  const scenarios = [
    { badge: 'To process', notice: 'Invoice received', status: 'DEPOSEE' },
    { badge: 'Processing', notice: 'Invoice processing', status: 'OCR_EN_COURS' },
    { badge: 'Waiting approval', notice: 'Waiting for approval', status: 'A_VERIFIER' },
    { badge: 'Approved', notice: 'Invoice approved', status: 'VALIDEE' },
    { badge: 'Accounted', notice: 'Accounting complete', status: 'COMPTABILISEE' },
    { badge: 'Ready to export', notice: 'Ready to export', status: 'EXPORTABLE' },
  ]

  for (const scenario of scenarios) {
    currentInvoice = {
      ...invoiceDetails,
      accountingEntry: scenario.status === 'COMPTABILISEE' || scenario.status === 'EXPORTABLE'
        ? balancedAccountingEntry
        : null,
      status: scenario.status,
    }
    await page.goto('/invoices/42')

    await expect(page.getByText(scenario.badge, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('status', { name: 'Invoice lifecycle status' }))
      .toContainText(scenario.notice)
    await expect(page.getByRole('button', { name: 'Request approval' })).toHaveCount(0)
  }
})

test('renders an unbalanced accounting entry with API totals and lines to review', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, unbalancedInvoiceDetails)
  ))

  await page.goto('/invoices/42')

  await expect(page.getByText('Accounting unbalanced', { exact: true })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Invoice lifecycle status' }))
    .toContainText('Accounting needs attention')
  await page.getByRole('tab', { name: 'Accounting' }).click()

  await expect(page.getByRole('heading', { name: 'Accounting entry' })).toBeVisible()
  await expect(page.getByText('Review the entry lines before continuing.')).toBeVisible()

  const summary = page.getByLabel('Accounting balance summary')
  await expect(summary.getByText('Needs attention')).toBeVisible()
  await expect(summary).toContainText('€1,260.00')
  await expect(summary).toContainText('€1,200.00')
  await expect(summary).toContainText('€60.00')

  await expect(page.getByRole('row', { name: /445660 Deductible VAT/ })).toContainText('€260.00')
  await expect(page.getByRole('row', { name: /401000 Supplier/ })).toContainText('€1,200.00')
  await expect(page.getByText('Ready to export', { exact: true })).toHaveCount(0)
})

test('corrects only the selected accounting line and refreshes its balance', async ({ page }) => {
  let correctionPayload: unknown
  let correctionUrl = ''
  let saved = false

  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, saved ? { ...balancedInvoiceDetails, status: 'EXPORTABLE' } : unbalancedInvoiceDetails)
  ))
  await mockApiRoute(page, '/v1/chart-of-accounts*', (route) => (
    fulfillJson(route, 200, chartOfAccountsPage)
  ))
  await mockApiRoute(page, '/v1/accounting-entries/15/lines/153', async (route) => {
    saved = true
    correctionPayload = route.request().postDataJSON()
    correctionUrl = route.request().url()
    await fulfillJson(route, 200, balancedAccountingEntry)
  })

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()
  await page.getByRole('button', { name: 'Edit accounting line 3' }).click()
  await page.getByLabel('Credit amount').fill('1260.00')
  await page.getByRole('button', { name: 'Save' }).click()

  expect(correctionUrl).toContain('/api/v1/accounting-entries/15/lines/153')
  expect(correctionPayload).toEqual({ creditAmount: '1260.00' })
  await expect(page.getByText('Accounting line saved')).toBeVisible()
  await expect(page.getByText(
    'Line 3 was updated and the balance was recalculated.',
  )).toBeVisible()
  await expect(page.getByLabel('Accounting balance summary')).toContainText('Balanced')
  await expect(page.getByLabel('Accounting balance summary')).toContainText('€0.00')
  await expect(page.getByText('Ready to export', { exact: true })).toBeVisible()
})

test('corrects the account and label through the active chart of accounts', async ({ page }) => {
  let correctionPayload: unknown
  const correctedEntry = {
    ...balancedAccountingEntry,
    lines: balancedAccountingEntry.lines.map((line) => (
      line.accountingEntryLineId === 151
        ? {
            ...line,
            accountLabel: 'Purchases',
            accountNumber: '607000',
            lineLabel: 'Office purchases',
          }
        : line
    )),
  }

  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, balancedInvoiceDetails)
  ))
  await mockApiRoute(page, '/v1/chart-of-accounts*', (route) => (
    fulfillJson(route, 200, chartOfAccountsPage)
  ))
  await mockApiRoute(page, '/v1/accounting-entries/15/lines/151', async (route) => {
    correctionPayload = route.request().postDataJSON()
    await fulfillJson(route, 200, correctedEntry)
  })

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()
  await page.getByRole('button', { name: 'Edit accounting line 1' }).click()
  await page.getByRole('combobox', { name: 'Account' }).click()
  await page.getByRole('option', { name: /607000 — Purchases/ }).click()
  await page.getByLabel('Line label').fill('Office purchases')
  await page.getByRole('button', { name: 'Save' }).click()

  expect(correctionPayload).toEqual({
    accountId: 2,
    lineLabel: 'Office purchases',
  })
  await expect(page.getByRole('row', { name: /607000 Office purchases/ })).toBeVisible()
})

test('keeps line changes visible for validation and status conflict errors', async ({ page }) => {
  let attempt = 0

  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, unbalancedInvoiceDetails)
  ))
  await mockApiRoute(page, '/v1/chart-of-accounts*', (route) => (
    fulfillJson(route, 200, chartOfAccountsPage)
  ))
  await mockApiRoute(page, '/v1/accounting-entries/15/lines/153', async (route) => {
    attempt += 1
    await fulfillJson(
      route,
      attempt === 1 ? 400 : 409,
      attempt === 1
        ? {
            code: 'ACCOUNTING_ENTRY_LINE_VALIDATION_ERROR',
            message: 'creditAmount exceeds the supported amount',
          }
        : {
            code: 'ACCOUNTING_ENTRY_NOT_MODIFIABLE',
            message: 'Accounting entry 15 is not modifiable',
          },
    )
  })

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()
  await page.getByRole('button', { name: 'Edit accounting line 3' }).click()
  await page.getByLabel('Credit amount').fill('1260.00')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('creditAmount exceeds the supported amount')).toBeVisible()
  await expect(page.getByLabel('Credit amount')).toHaveValue('1260.00')

  await page.getByLabel('Credit amount').fill('1250.00')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Accounting entry 15 is not modifiable')).toBeVisible()
  await expect(page.getByLabel('Credit amount')).toHaveValue('1250.00')
})

test('keeps exported, paid and archived invoices read-only', async ({ page }) => {
  let currentInvoice = balancedInvoiceDetails
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, currentInvoice)
  ))

  const scenarios = [
    { badge: 'Exported', notice: 'Invoice exported', status: 'EXPORTEE' },
    { badge: 'Paid', notice: 'Invoice paid', status: 'PAYEE' },
    { badge: 'Archived', notice: 'Archived — read only', status: 'ARCHIVEE' },
  ]

  for (const scenario of scenarios) {
    currentInvoice = { ...balancedInvoiceDetails, status: scenario.status }
    await page.goto('/invoices/42')

    await expect(page.getByText(scenario.badge, { exact: true })).toBeVisible()
    await expect(page.getByRole('status', { name: scenario.status === 'ARCHIVEE'
      ? 'Archived document notice'
      : 'Invoice lifecycle status' }))
      .toContainText(scenario.notice)
    await expect(page.getByLabel('Invoice number')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Request approval' })).toHaveCount(0)

    await page.getByRole('tab', { name: 'Accounting' }).click()

    await expect(page.getByText('Accounting entry is read-only')).toBeVisible()
    await expect(page.getByRole('button', { name: /Edit accounting line/ })).toHaveCount(0)
  }
})

for (const [role, width] of [
  ['ADMIN', 1440],
  ['OPERATEUR_COMPTABLE', 390],
  ['RESPONSABLE_COMPTABLE', 768],
] as const) {
  test(`keeps archived invoice actions absent for ${role}, including stale duplicate alerts`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1024 })
    await mockCurrentUser(page, { ...currentUser, role: { id: 1, code: role, label: role } })
    const mutations: string[] = []
    page.on('request', (request) => {
      if (/\/api\/v1\/(invoices|accounting-entries)/.test(request.url())
        && !['GET', 'OPTIONS'].includes(request.method())) {
        mutations.push(`${request.method()} ${request.url()}`)
      }
    })
    await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
      ...balancedInvoiceDetails,
      status: 'ARCHIVEE',
      archivedAt: '2026-09-07T15:30:00',
      duplicateAlerts: [pendingDuplicateAlert],
      history: [
        ...invoiceHistory,
        { ...invoiceHistory[0], action: 'ARCHIVEE', date: '2026-09-07T15:30:00', comment: 'Invoice archived' },
      ],
    }))
    await mockApiRoute(page, '/v1/invoices/42/file', async (route) => {
      expect(route.request().headers().authorization).toBe('Bearer e2e-token')
      await fulfillOriginalInvoicePdf(route)
    })
    await page.goto('/invoices/42')

    const notice = page.getByRole('status', { name: 'Archived document notice' })
    await expect(notice).toContainText('Archived on 07 Sept 2026')
    await expect(page.getByText('Archived', { exact: true })).toBeVisible()
    await expect(page.getByText('Duplicate suspected', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/fields? require(s)? review/)).toHaveCount(0)
    await expect(page.getByLabel('Invoice number')).toBeDisabled()
    await expect(page.getByRole('combobox', { name: 'Supplier', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: /^(Save|Request approval|Retry OCR|Not a duplicate|Review duplicate)$/ })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Invoice PDF page 1' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`archive-detail-${width}.png`), fullPage: true })

    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByRole('img', { name: 'Invoice PDF page 2' })).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download original invoice' }).click()
    expect((await downloadPromise).suggestedFilename()).toBe('Leroy Construction — INV-2026-0421.pdf')

    await page.getByRole('tab', { name: 'Accounting' }).click()
    await expect(notice).toBeVisible()
    await expect(page.getByRole('button', { name: /Edit accounting line/ })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Approval' }).click()
    await expect(notice).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Approve|Reject|Request changes|Edit invoice)$/ })).toHaveCount(0)
    await page.keyboard.press('a')
    await page.keyboard.press('r')
    await page.keyboard.press('c')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Activity' }).click()
    await expect(notice).toBeVisible()
    await expect(page.getByRole('list', { name: 'Invoice activity' })).toContainText('Invoice archived')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(mutations).toEqual([])
  })
}

test('does not invent an archive date when it is unavailable', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
    ...invoiceDetails, status: 'ARCHIVEE', archivedAt: null,
  }))
  await page.goto('/invoices/42')
  const notice = page.getByRole('status', { name: 'Archived document notice' })
  await expect(notice).toBeVisible()
  await expect(notice.locator('time')).toHaveCount(0)
})

test('keeps an archived invoice read-only when original file access is denied', async ({ page }) => {
  let downloads = 0
  page.on('download', () => { downloads += 1 })
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
    ...invoiceDetails, status: 'ARCHIVEE',
  }))
  await mockApiRoute(page, '/v1/invoices/42/file', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    await fulfillJson(route, 403, { code: 'ACCESS_DENIED' })
  })
  await page.goto('/invoices/42')
  const documentPanel = page.getByLabel('Original invoice document')
  await expect(documentPanel.getByText('Document access denied', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download original invoice' })).toBeDisabled()
  await expect(documentPanel.getByRole('img')).toHaveCount(0)
  await expect(documentPanel.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  await expect(page.getByLabel('Invoice number')).toBeDisabled()
  await expect(page.getByRole('status', { name: 'Archived document notice' })).toBeVisible()
  expect(downloads).toBe(0)
})

test('shows a balanced entry without claiming export eligibility before backend confirmation', async ({ page }) => {
  let currentInvoice = balancedInvoiceDetails
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, currentInvoice)
  ))

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()

  const summary = page.getByLabel('Accounting balance summary')
  await expect(summary.getByText('Balanced', { exact: true })).toBeVisible()
  await expect(summary).toContainText('€0.00')
  await expect(page.getByText('Ready to export', { exact: true })).toHaveCount(0)

  currentInvoice = { ...balancedInvoiceDetails, status: 'EXPORTABLE' }
  await page.reload()

  await expect(page.getByText('Ready to export', { exact: true }).first()).toBeVisible()
})

test('keeps the accounting balance readable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, unbalancedInvoiceDetails)
  ))
  await mockApiRoute(page, '/v1/chart-of-accounts*', (route) => (
    fulfillJson(route, 200, chartOfAccountsPage)
  ))

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()

  const summary = page.getByLabel('Accounting balance summary')
  await expect(summary.getByText('Needs attention')).toBeVisible()
  await expect(summary).toContainText('€60.00')
  await expect(page.getByRole('row', { name: /445660 Deductible VAT/ })).toBeVisible()
  await page.getByRole('button', { name: 'Edit accounting line 3' }).click()
  await expect(page.getByLabel('Credit amount')).toBeVisible()

  const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
  const viewportWidth = await page.evaluate(() => window.innerWidth)
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth)
})

test('shows the available submission context while an invoice waits for approval', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, waitingApprovalDetails)
  ))
  await mockApiRoute(page, '/v1/invoices/42/history', (route) => (
    fulfillJson(route, 200, approvalHistory)
  ))

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Approval' }).click()

  await expect(page.getByRole('heading', { name: 'Approval', exact: true })).toBeVisible()
  await expect(page.getByText('Waiting for approval', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Approval timeline' })).toBeVisible()
  await expect(page.getByText('Approval requested', { exact: true })).toBeVisible()
  await expect(page.getByText('Alex Martin · requested 13 Aug 2026')).toBeVisible()
  await expect(page.getByText('Submitted by')).toBeVisible()
  await expect(page.getByText('13 Aug 2026', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await expect(page.getByLabel('Original invoice document')).not.toBeVisible()
})

test('offers approval decisions only to the accounting manager', async ({ page }) => {
  let validationCount = 0
  await mockApiRoute(page, '/v1/users/me', (route) => fulfillJson(route, 200, {
    ...currentUser,
    role: { ...currentUser.role, code: 'RESPONSABLE_COMPTABLE' },
  }))
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, waitingApprovalDetails)
  ))
  await mockApiRoute(page, '/v1/invoices/42/history', (route) => (
    fulfillJson(route, 200, approvalHistory)
  ))
  await mockApiRoute(page, '/v1/invoices/42/validate', async (route) => {
    validationCount += 1
    await fulfillJson(route, 200, { invoiceId: 42, status: 'VALIDEE' })
  })

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Approval' }).click()

  await expect(page.getByRole('button', { name: 'Request changes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible()
  await page.getByRole('button', { name: 'Approve' }).click()

  await expect(page.getByText('Approved').first()).toBeVisible()
  expect(validationCount).toBe(1)
})

test('exposes the rejection reason and history with the permitted correction action', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => (
    fulfillJson(route, 200, rejectedInvoiceDetails)
  ))
  await mockApiRoute(page, '/v1/invoices/42/history', (route) => (
    fulfillJson(route, 200, rejectionHistory)
  ))

  await page.goto('/invoices/42')

  await expect(page.getByText('Invoice rejected', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Invoice number')).toBeEnabled()
  await page.getByRole('tab', { name: 'Approval' }).click()

  await expect(page.getByText('Rejection reason')).toBeVisible()
  await expect(page.getByText(
    'Incorrect amount: VAT total does not match the document.',
  )).toBeVisible()
  await expect(page.getByText('Rejected by')).toBeVisible()
  await expect(page.getByText('Marie Laurent', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Edit invoice' }).click()

  await expect(page.getByRole('tab', { name: 'Details' })).toHaveAttribute('data-state', 'active')
  await expect(page.getByLabel('Original invoice document')).toBeVisible()
})

test('shows the suspected duplicate and compares the backend detection criteria', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) =>
    fulfillJson(route, 200, duplicateInvoiceDetails),
  )
  await mockApiRoute(page, '/v1/invoices/39', (route) =>
    fulfillJson(route, 200, matchingInvoiceDetails),
  )

  await page.goto('/invoices/42')

  await expect(page.getByText('Duplicate suspected')).toBeVisible()
  await expect(page.getByText('Possible duplicate invoice')).toBeVisible()
  await expect(page.getByText(/Matches INV-2026-0398 from Leroy Construction/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request approval' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Review duplicate' }).click()

  const dialog = page.getByRole('dialog', { name: 'Review possible duplicate' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('matching supplier, invoice date and total amount')).toBeVisible()
  await expect(dialog.getByRole('row', { name: /Supplier/ })).toContainText('Leroy Construction')
  await expect(dialog.getByRole('row', { name: /Invoice number/ })).toContainText('INV-2026-0398')
  await expect(dialog.getByRole('row', { name: /Invoice date/ })).toContainText('13 Aug 2026')
  await expect(dialog.getByRole('row', { name: /Total/ })).toContainText('€1,500.60')
  await expect(dialog.getByRole('link', { name: 'Open similar invoice' })).toHaveAttribute(
    'href',
    '/invoices/39',
  )
})

test('ignores a suspected duplicate and refreshes its status and activity', async ({ page }) => {
  let decisionPayload: unknown
  const duplicateHistory = [{
    action: 'IGNORE',
    author: 'Alex Martin',
    authorId: 1,
    comment: 'Two distinct purchases',
    date: '2026-09-01T11:45:00',
    duplicateAlertId: 71,
    fieldName: null,
    newValue: null,
    oldValue: null,
    type: 'DUPLICATE_DECISION',
  }]
  const updatedInvoice = {
    ...duplicateDecisionDetails('IGNORE', 'A_VERIFIER', 'Two distinct purchases'),
    history: duplicateHistory,
  }

  await mockApiRoute(page, '/v1/invoices/42', (route) =>
    fulfillJson(route, 200, duplicateInvoiceDetails),
  )
  await mockApiRoute(page, '/v1/invoices/42/duplicate-alerts/71/decision', async (route) => {
    decisionPayload = route.request().postDataJSON()
    await fulfillJson(route, 200, updatedInvoice)
  })
  await page.goto('/invoices/42')
  await page.getByRole('button', { name: 'Not a duplicate' }).first().click()

  await expect(page.getByText('Waiting approval')).toBeVisible()
  await expect(page.getByText('Possible duplicate invoice')).toHaveCount(0)
  expect(decisionPayload).toEqual({ decision: 'IGNORE' })

  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByText('Alex Martin · Duplicate alert ignored')).toBeVisible()
  await page.getByRole('button', { name: 'View details: Duplicate alert ignored' }).click()
  await expect(page.getByText('Two distinct purchases')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Duplicate alert ignored details' })).toContainText('1 Sept 2026, 11:45')
})

test('confirms a duplicate from the comparison and updates the invoice immediately', async ({ page }) => {
  let decisionPayload: unknown

  await mockApiRoute(page, '/v1/invoices/42', (route) =>
    fulfillJson(route, 200, duplicateInvoiceDetails),
  )
  await mockApiRoute(page, '/v1/invoices/39', (route) =>
    fulfillJson(route, 200, matchingInvoiceDetails),
  )
  await mockApiRoute(page, '/v1/invoices/42/duplicate-alerts/71/decision', async (route) => {
    decisionPayload = route.request().postDataJSON()
    await fulfillJson(route, 200, duplicateDecisionDetails('CONFIRM', 'REJETEE'))
  })

  await page.goto('/invoices/42')
  await page.getByRole('button', { name: 'Review duplicate' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm duplicate' }).click()

  await expect(page.getByText('Rejected', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(decisionPayload).toEqual({ decision: 'CONFIRM' })
})

test('requires and submits a reason when rejecting the suspected invoice', async ({ page }) => {
  let decisionPayload: unknown

  await mockApiRoute(page, '/v1/invoices/42', (route) =>
    fulfillJson(route, 200, duplicateInvoiceDetails),
  )
  await mockApiRoute(page, '/v1/invoices/39', (route) =>
    fulfillJson(route, 200, matchingInvoiceDetails),
  )
  await mockApiRoute(page, '/v1/invoices/42/duplicate-alerts/71/decision', async (route) => {
    decisionPayload = route.request().postDataJSON()
    await fulfillJson(
      route,
      200,
      duplicateDecisionDetails('REJECT', 'REJETEE', 'Document sent by mistake'),
    )
  })

  await page.goto('/invoices/42')
  await page.getByRole('button', { name: 'Review duplicate' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Reject invoice…' }).click()
  await expect(dialog.getByRole('button', { name: 'Reject invoice', exact: true })).toBeDisabled()
  await dialog.getByLabel('Rejection reason').fill('Document sent by mistake')
  await dialog.getByRole('button', { name: 'Reject invoice', exact: true }).click()

  await expect(page.getByText('Rejected', { exact: true })).toBeVisible()
  expect(decisionPayload).toEqual({
    decision: 'REJECT',
    reason: 'Document sent by mistake',
  })
})

test('sends only changed OCR values and keeps the manual correction after reload', async ({ page }) => {
  let currentDetails = invoiceDetails
  let correctionPayload: unknown

  await mockApiRoute(page, '/v1/invoices/42', async (route) => {
    if (route.request().method() === 'PATCH') {
      correctionPayload = route.request().postDataJSON()
      currentDetails = correctedInvoiceDetails
    }

    await fulfillJson(route, 200, currentDetails)
  })

  await page.goto('/invoices/42')

  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await page.getByLabel('Tax', { exact: true }).fill('260.10')
  await expect(page.getByText('Unsaved change')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request approval' })).toBeDisabled()

  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Corrections saved.')
  await expect(page.getByText('Edited manually')).toBeVisible()
  expect(correctionPayload).toEqual({ totalTva: '260.10' })

  await page.getByRole('tab', { name: 'Activity' }).click()
  const event = page.getByRole('list', { name: 'Invoice activity' }).getByRole('listitem').first()
  await expect(event).toContainText('Alex Martin · Tax changed')
  await event.getByRole('button', { name: 'View details: Tax changed' }).click()
  await expect(event.getByRole('definition')).toHaveText([
    'Tax', '250.10', '260.10', 'Alex Martin', '13 Aug 2026, 11:32',
  ])

  await page.reload()

  await expect(page.getByLabel('Tax', { exact: true })).toHaveValue('260.10')
  await expect(page.getByText('Edited manually')).toBeVisible()
})

test('searches and attaches a supplier by its canonical identifier', async ({ page }) => {
  const supplierQueries: string[] = []
  let patchCount = 0
  let correctionPayload: unknown

  await mockApiRoute(page, '/v1/invoices/42', async (route) => {
    if (route.request().method() === 'PATCH') {
      patchCount += 1
      correctionPayload = route.request().postDataJSON()
      if (patchCount === 1) {
        await fulfillJson(route, 409, {
          code: 'SUPPLIER_IDENTIFIER_CONFLICT',
          message: 'This supplier cannot be attached because its legal identifier conflicts.',
        })
        return
      }
    }

    await fulfillJson(route, 200, patchCount ? reassignedInvoiceDetails : invoiceDetails)
  })
  await mockApiRoute(page, '/v1/suppliers*', async (route) => {
    const requestUrl = new URL(route.request().url())
    supplierQueries.push(requestUrl.searchParams.get('query') ?? '')
    await fulfillJson(route, 200, supplierOptionsPage)
  })

  await page.goto('/invoices/42')
  const supplierCombobox = page.getByRole('combobox', { name: 'Supplier' })
  await supplierCombobox.click()
  await page.getByRole('combobox', { name: 'Search suppliers' }).fill('Vinci')

  await expect.poll(() => supplierQueries.at(-1)).toBe('Vinci')
  await expect(page.getByRole('option', {
    name: 'Select supplier Vinci Energies France SAS',
  })).toContainText('SIRET 55210055400013')
  await page.getByRole('option', {
    name: 'Select supplier Vinci Energies France SAS',
  }).click()

  await expect(supplierCombobox).toContainText('Vinci Energies France SAS')
  await expect(page.getByText('Unsaved change')).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('alert').filter({
    hasText: 'Unable to save corrections',
  })).toContainText('This supplier cannot be attached because its legal identifier conflicts.')
  await expect(supplierCombobox).toContainText('Vinci Energies France SAS')

  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Corrections saved.')
  await expect(supplierCombobox).toContainText('Vinci Energies France SAS')
  expect(correctionPayload).toEqual({ supplierId: 84 })
})

test('keeps an unmatched supplier explicit without creating a placeholder', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
    ...invoiceDetails,
    supplier: null,
    supplierName: null,
  }))

  await page.goto('/invoices/42')

  await expect(page.getByRole('combobox', { name: 'Supplier' })).toContainText(
    'No supplier selected',
  )
  await expect(page.getByText('Missing field')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
})

test('renders and controls the original multi-page PDF', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value() {
        this.setAttribute('data-fullscreen-requested', 'true')
        return Promise.resolve()
      },
    })
  })
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))

  await page.goto('/invoices/42')

  const canvas = page.getByRole('img', { name: 'Invoice PDF page 1' })
  await expect(canvas).toBeVisible()
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
  await expect(page.getByText('PDF · 2 pages · 956 B')).toBeVisible()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('img', { name: 'Invoice PDF page 2' })).toBeVisible()
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByText('125%', { exact: true })).toBeVisible()
  const portraitSize = await page.getByRole('img', { name: 'Invoice PDF page 2' }).evaluate(
    (element) => ({ height: element.clientHeight, width: element.clientWidth }),
  )

  await page.getByRole('button', { name: 'Rotate document' }).click()
  await expect.poll(async () => page.getByRole('img', { name: 'Invoice PDF page 2' }).evaluate(
    (element) => ({ height: element.clientHeight, width: element.clientWidth }),
  )).toEqual({ height: portraitSize.width, width: portraitSize.height })

  await page.getByRole('button', { name: 'Fit to width' }).click()
  await expect(page.getByText('125%', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Open document full screen' }).click()
  await expect(page.getByLabel('Original invoice document')).toHaveAttribute(
    'data-fullscreen-requested',
    'true',
  )

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download original invoice' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('Leroy Construction — INV-2026-0421.pdf')
})

test('shows the OCR failure while keeping the original invoice accessible', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) =>
    fulfillJson(route, 200, retryableOcrFailureDetails),
  )

  await page.goto('/invoices/42')

  await expect(page.getByText('OCR error')).toBeVisible()
  await expect(page.getByText('OCR processing failed', { exact: true })).toBeVisible()
  await expect(page.getByText('OCR service is temporarily unavailable')).toBeVisible()
  await expect(page.getByText('Error code: OCR_SERVICE_UNAVAILABLE')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry OCR' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Invoice PDF page 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download original invoice' })).toBeEnabled()
})

test('retries OCR on the existing invoice and refreshes its details', async ({ page }) => {
  let retryRequests = 0
  let finishRetry!: () => void
  const retryResponse = new Promise<void>((resolve) => { finishRetry = resolve })

  await mockApiRoute(page, '/v1/invoices/42', (route) =>
    fulfillJson(route, 200, retryableOcrFailureDetails),
  )
  await mockApiRoute(page, '/v1/invoices/42/ocr/retry', async (route) => {
    retryRequests += 1
    expect(route.request().method()).toBe('POST')
    await retryResponse
    await fulfillJson(route, 200, invoiceDetails)
  })

  await page.goto('/invoices/42')
  await page.getByRole('button', { name: 'Retry OCR' }).click()

  await expect(page.getByRole('button', { name: 'Retrying OCR…' })).toBeDisabled()
  await expect(page.getByText('Needs review', { exact: true })).toHaveCount(0)
  finishRetry()

  await expect(page.getByText('Needs review')).toBeVisible()
  await expect(page.getByText('OCR processing failed', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Request approval' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Invoice PDF page 1' })).toBeVisible()
  expect(retryRequests).toBe(1)
  expect(page.url()).toMatch(/\/invoices\/42$/)
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByText('Alex Martin · OCR extraction completed')).toBeVisible()
})

test('offers manual correction when the OCR failure cannot be retried', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) =>
    fulfillJson(route, 200, nonRetryableOcrFailureDetails),
  )

  await page.goto('/invoices/42')

  await expect(page.getByRole('button', { name: 'Retry OCR' })).toHaveCount(0)
  await expect(page.getByText('This error cannot be fixed by retrying OCR.')).toBeVisible()
  await page.getByRole('button', { name: 'Enter details manually' }).click()
  await expect(page.getByRole('combobox', { name: 'Supplier' })).toBeFocused()

  await page.getByLabel('Invoice number').fill('INV-2026-0421-CORRECTED')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
})

test('keeps a document error isolated from the invoice data', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))
  await mockApiRoute(page, '/v1/invoices/42/file', (route) =>
    fulfillJson(route, 503, { message: 'Unavailable' }),
  )

  await page.goto('/invoices/42')

  await expect(
    page.getByRole('alert').filter({ hasText: 'Unable to display the original invoice' }),
  ).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Supplier' })).toContainText(
    'Leroy Construction SAS',
  )
})

test('renders activity included in invoice details without another request', async ({ page }) => {
  let historyRequestCount = 0
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))
  await mockApiRoute(page, '/v1/invoices/42/history', async (route) => {
    historyRequestCount += 1
    await fulfillJson(route, 200, invoiceHistory)
  })

  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByLabel('Original invoice document')).toBeHidden()
  await page.getByRole('button', { name: 'View details: OCR extraction completed' }).click()
  await expect(page.getByText('OCR analysis completed')).toBeVisible()
  expect(historyRequestCount).toBe(0)
})

test('orders audit events newest first and preserves changes, reasons and missing authors', async ({ page }) => {
  const history: InvoiceHistoryItem[] = [
    invoiceHistory[0],
    {
      ...invoiceHistory[0],
      type: 'CORRECTION',
      action: 'FIELD_CORRECTION',
      date: '2026-08-13T11:32:00',
      fieldName: 'commandReference',
      oldValue: 'PO-2026-0184',
      newValue: null,
      comment: 'Removed an incorrect purchase order.\nChecked against the original PDF.',
    },
    {
      ...invoiceHistory[0],
      type: 'VALIDATION_DECISION',
      action: 'REJECTION',
      author: 'Marie Laurent',
      authorId: 8,
      date: '2026-08-13T11:42:00',
      comment: 'Missing purchase order',
    },
    { ...invoiceHistory[0], author: null, authorId: null, date: 'invalid-date' },
  ]
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
    ...invoiceDetails, history,
  }))
  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Activity' }).click()
  const events = page.getByRole('list', { name: 'Invoice activity' }).getByRole('listitem')
  await expect(events).toHaveCount(4)
  await expect(events.nth(0)).toContainText('Marie Laurent · Invoice rejected')
  await expect(events.nth(1)).toContainText('Alex Martin · Purchase order changed')
  await expect(events.nth(2)).toContainText('Alex Martin · OCR extraction completed')
  await expect(events.nth(3)).toContainText('Author unavailable')
  await expect(events.nth(3)).toContainText('invalid-date')
  await expect(page.getByText('4 recorded events')).toBeVisible()

  const toggle = events.nth(1).getByRole('button')
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const details = page.getByRole('region', { name: 'Purchase order changed details' })
  await expect(details.getByRole('definition')).toHaveText([
    'Purchase order', 'PO-2026-0184', 'Not set', 'Alex Martin', '13 Aug 2026, 11:32',
    'Removed an incorrect purchase order.\nChecked against the original PDF.',
  ])
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(details).toBeHidden()
})

test('shows an explicit empty audit history without fabricated events', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
    ...invoiceDetails, history: [],
  }))
  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByText('No activity yet')).toBeVisible()
  await expect(page.getByText('0 recorded events')).toBeVisible()
  await expect(page.getByRole('button', { name: /View details:/ })).toHaveCount(0)
})

test('refreshes activity after submission and retries history errors without resubmitting', async ({ page }) => {
  let submissionCount = 0
  let historyCount = 0
  let finishHistory!: () => void
  const historyResponse = new Promise<void>((resolve) => { finishHistory = resolve })
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))
  await mockApiRoute(page, '/v1/invoices/42/submit-for-validation', async (route) => {
    submissionCount += 1
    await fulfillJson(route, 200, { invoiceId: 42, status: 'A_VERIFIER' })
  })
  await mockApiRoute(page, '/v1/invoices/42/history', async (route) => {
    expect(route.request().method()).toBe('GET')
    historyCount += 1
    if (historyCount === 1) {
      await historyResponse
      await fulfillJson(route, 503, { message: 'History temporarily unavailable' })
    } else {
      await fulfillJson(route, 200, approvalHistory)
    }
  })
  await page.goto('/invoices/42')
  await page.getByRole('button', { name: 'Request approval' }).click()
  await expect(page.getByText('Waiting approval', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByRole('status', { name: 'Loading invoice activity' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Invoice activity' })).toHaveCount(0)
  finishHistory()
  await expect(page.getByText('Unable to load activity')).toBeVisible()
  await page.getByRole('button', { name: 'Retry activity' }).click()
  await expect(page.getByText('Alex Martin · Status changed to Waiting approval')).toBeVisible()
  expect(submissionCount).toBe(1)
  expect(historyCount).toBe(2)
  await page.getByRole('tab', { name: 'Details' }).click()
  await expect(page.getByLabel('Original invoice document')).toBeVisible()
})

test('refreshes activity after approval using the backend validation decision', async ({ page }) => {
  let approved = false
  await mockCurrentUser(page, {
    ...currentUser, role: { ...currentUser.role, code: 'RESPONSABLE_COMPTABLE' },
  })
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, waitingApprovalDetails))
  await mockApiRoute(page, '/v1/invoices/42/history', (route) => fulfillJson(route, 200, approved
    ? [...approvalHistory, {
        ...invoiceHistory[0], type: 'VALIDATION_DECISION', action: 'VALIDATION',
        date: '2026-09-02T12:00:00', author: 'Marie Laurent', authorId: 8, comment: null,
      }]
    : approvalHistory))
  await mockApiRoute(page, '/v1/invoices/42/validate', async (route) => {
    expect(route.request().method()).toBe('POST')
    approved = true
    await fulfillJson(route, 200, { invoiceId: 42, status: 'VALIDEE' })
  })
  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Approval' }).click()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Approval' })).toHaveAttribute('data-state', 'active')
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByRole('list', { name: 'Invoice activity' }).getByRole('listitem').first())
    .toContainText('Marie Laurent · Invoice approved')
})

test('keeps rejected corrections editable and adds activity only after a successful save', async ({ page }) => {
  let patchCount = 0
  await mockApiRoute(page, '/v1/invoices/42', async (route) => {
    if (route.request().method() === 'PATCH') {
      patchCount += 1
      expect(route.request().postDataJSON()).toEqual({ totalTva: '260.10' })
      await fulfillJson(route, patchCount === 1 ? 409 : 200, patchCount === 1
        ? { message: 'Invoice changed. Check its current values before saving.' }
        : correctedInvoiceDetails)
      return
    }
    await fulfillJson(route, 200, invoiceDetails)
  })
  await page.goto('/invoices/42')
  await page.getByLabel('Tax', { exact: true }).fill('260.10')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Invoice changed.' })).toBeVisible()
  await expect(page.getByLabel('Tax', { exact: true })).toHaveValue('260.10')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await expect(page.getByText('Corrections saved.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Corrections saved.')).toBeVisible()
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByText('Alex Martin · Tax changed')).toBeVisible()
  expect(patchCount).toBe(2)
})

test('retains the original PDF and records another failed OCR attempt in activity', async ({ page }) => {
  const failure = {
    invoiceId: 42,
    status: 'ERREUR_OCR',
    ocrError: { ...retryableOcrFailureDetails.ocrError, occurredAt: '2026-09-02T12:00:00' },
  }
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, retryableOcrFailureDetails))
  await mockApiRoute(page, '/v1/invoices/42/ocr/retry', (route) => fulfillJson(route, 503, failure))
  await mockApiRoute(page, '/v1/invoices/42/history', (route) => fulfillJson(route, 200, [{
    ...invoiceHistory[0], action: 'ERREUR_OCR', date: failure.ocrError.occurredAt,
    comment: 'Second OCR attempt failed: service unavailable',
  }]))
  await page.goto('/invoices/42')
  await page.getByRole('button', { name: 'Retry OCR' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'OCR could not be restarted.' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Invoice PDF page 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry OCR' })).toBeEnabled()
  await page.getByRole('tab', { name: 'Activity' }).click()
  await page.getByRole('button', { name: 'View details: OCR processing failed' }).click()
  await expect(page.getByText('Second OCR attempt failed: service unavailable')).toBeVisible()
})

test('does not dismiss a duplicate or invent a decision when the API rejects it', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, duplicateInvoiceDetails))
  await mockApiRoute(page, '/v1/invoices/42/duplicate-alerts/71/decision', (route) => (
    fulfillJson(route, 409, { message: 'Duplicate decision conflict' })
  ))
  await page.goto('/invoices/42')
  await page.getByRole('button', { name: 'Not a duplicate' }).first().click()
  await expect(page.getByRole('tabpanel', { name: 'Details' }).getByRole('alert').filter({ hasText: 'The duplicate decision could not be saved.' })).toBeVisible()
  await expect(page.getByText('Possible duplicate invoice')).toBeVisible()
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByRole('button', { name: 'View details: Duplicate alert ignored' })).toHaveCount(0)
  await expect(page.getByText('1 recorded event')).toBeVisible()
})

for (const width of [1440, 768, 390]) {
  test(`keeps the audit timeline and expanded values usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 })
    await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, {
      ...correctedInvoiceDetails,
      history: [...correctedInvoiceDetails.history, {
        ...invoiceHistory[0], type: 'COMMENT', action: 'COMMENT_ADDED',
        date: '2026-08-13T12:00:00', comment: 'LongReference'.repeat(30),
      }],
    }))
    await page.goto('/invoices/42')
    await page.getByRole('tab', { name: 'Details' }).focus()
    await page.keyboard.press('End')
    await expect(page.getByRole('tab', { name: 'Activity' })).toHaveAttribute('data-state', 'active')
    await page.getByRole('button', { name: 'View details: Tax changed' }).click()
    await expect(page.getByRole('region', { name: 'Tax changed details' })).toBeVisible()
    await page.getByRole('button', { name: 'View details: Comment added' }).click()
    await expect(page.getByText('LongReference'.repeat(30))).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Audit properties' })).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
    await page.getByRole('button', { name: 'Hide details: Comment added' }).click()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`activity-${width}.png`), fullPage: true })
    await page.getByRole('tab', { name: 'Details' }).click()
    await expect(page.getByLabel('Tax', { exact: true })).toHaveValue('260.10')
    await expect(page.getByRole('button', { name: 'Download original invoice' })).toBeEnabled()
  })
}

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
  expect(requestedUrls.at(-1)?.searchParams.getAll('status')).toEqual(['EXTRAITE'])
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

test('KAN-395 generates once and displays only the server confirmed entry', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, { ...invoiceDetails, status: 'VALIDEE' }))
  let pending: Route | undefined
  let calls = 0
  await mockApiRoute(page, '/v1/invoices/42/accounting-entry', async (route) => {
    calls += 1
    expect(route.request().method()).toBe('POST')
    expect(route.request().postData()).toBeNull()
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    pending = route
  })
  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()
  await page.getByRole('button', { name: 'Generate accounting entry' }).click()
  await expect(page.getByRole('button', { name: 'Generating entry…' })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'No accounting entry yet' })).toBeVisible()
  await expect.poll(() => Boolean(pending)).toBe(true)
  await fulfillJson(pending!, 200, { invoiceId: 42, status: 'EXPORTABLE', accountingEntry: balancedAccountingEntry })
  await expect(page.getByText('ACC-2026-0421', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate accounting entry' })).toHaveCount(0)
  expect(calls).toBe(1)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(page.getByLabel('Accounting balance summary')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `/private/tmp/accounting-front-tools/kan395-${width}.png`, fullPage: true })
  }
})

for (const status of [403, 404, 409, 500]) {
  test(`KAN-395 preserves empty entry after generation error ${status}`, async ({ page }) => {
    await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, { ...invoiceDetails, status: 'VALIDEE' }))
    await mockApiRoute(page, '/v1/invoices/42/accounting-entry', (route) => fulfillJson(route, status, { message: 'Configure accounting rules first' }))
    await page.goto('/invoices/42')
    await page.getByRole('tab', { name: 'Accounting' }).click()
    await page.getByRole('button', { name: 'Generate accounting entry' }).click()
    await expect(page.getByText('Unable to generate accounting entry', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No accounting entry yet' })).toBeVisible()
  })
}

test('KAN-395 reloads a persisted unbalanced proposal after conflict', async ({ page }) => {
  let generated = false
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200,
    generated ? unbalancedInvoiceDetails : { ...invoiceDetails, status: 'VALIDEE' }))
  await mockApiRoute(page, '/v1/invoices/42/accounting-entry', (route) => {
    generated = true
    return fulfillJson(route, 409, { code: 'ACCOUNTING_ENTRY_UNBALANCED', accountingEntryId: 15 })
  })
  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()
  await page.getByRole('button', { name: 'Generate accounting entry' }).click()
  await expect(page.getByText('ACC-2026-0421', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Accounting balance summary').getByText('Needs attention')).toBeVisible()
})

test('KAN-395 explains validation prerequisite', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, invoiceDetails))
  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()
  await expect(page.getByRole('button', { name: 'Generate accounting entry' })).toBeDisabled()
  await expect(page.getByText('Validate this invoice before generating its accounting entry.')).toBeVisible()
})

test('KAN-396 adds VAT and analytics then removes only confirmed selected lines', async ({ page }) => {
  let entry = { ...balancedAccountingEntry, version: 3 }
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, { ...balancedInvoiceDetails, accountingEntry: entry, status: 'VALIDEE' }))
  await mockApiRoute(page, '/v1/chart-of-accounts*', (route) => fulfillJson(route, 200, chartOfAccountsPage))
  await mockApiRoute(page, '/v1/classifications*', (route) => fulfillJson(route, 200, { content: [{ classificationId: 7, name: 'Site Alpha', type: 'CHANTIER', active: true }], totalPages: 1 }))
  let pending: Route | undefined
  await mockApiRoute(page, '/v1/accounting-entries/15/lines', async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['if-match']).toBe('"3"')
    expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect(route.request().postDataJSON()).toMatchObject({ lineLabel: 'Site purchase', debitAmount: '10', creditAmount: '0', vatRate: '20', classificationId: 7 })
    pending = route
  })
  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()
  await page.getByRole('button', { name: 'Add line', exact: true }).click()
  await page.getByRole('combobox', { name: 'Account', exact: true }).click()
  await page.getByRole('option', { name: /607000 — Purchases/ }).click()
  await page.getByLabel('Line label').fill('Site purchase')
  await page.getByLabel('Debit amount').fill('10')
  await page.getByLabel('VAT rate (%)').fill('20')
  await page.getByRole('combobox', { name: 'Analytic allocation' }).click()
  await page.getByRole('option', { name: /Site Alpha/ }).click()
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.getByRole('form', { name: 'Add accounting line' }).scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `/private/tmp/accounting-front-tools/kan396-${width}.png`, fullPage: true })
  }

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect.poll(() => Boolean(pending)).toBe(true)
  entry = { ...entry, version: 4, balanced: false, totalDebit: '1270.00', balanceDifference: '10.00', lines: [...entry.lines, {
    ...entry.lines[0], accountingEntryLineId: 154, lineNumber: 4, lineLabel: 'Site purchase', debitAmount: '10.00',
    ...{ accountId: 2, vatRate: '20.00', classificationId: 7, classificationName: 'Site Alpha' },
  }] }
  await fulfillJson(pending!, 201, entry)
  await expect(page.getByRole('row', { name: /Site purchase/ })).toContainText('20.00% · Site Alpha')
  await expect(page.getByText('Ready to export', { exact: true })).toHaveCount(0)
  let removed = false
  await mockApiRoute(page, '/v1/accounting-entries/15/lines/154', async (route) => {
    expect(route.request().method()).toBe('DELETE')
    expect(route.request().headers()['if-match']).toBe('"4"')
    removed = true
    entry = { ...balancedAccountingEntry, version: 5 }
    await fulfillJson(route, 200, entry)
  })
  await page.getByRole('checkbox', { name: 'Select accounting line 4', exact: true }).check()
  await page.getByRole('button', { name: 'Remove 1 selected' }).click()
  expect(removed).toBe(false)
  await expect(page.getByRole('dialog')).toContainText('Site purchase')
  await page.getByRole('button', { name: 'Confirm removal' }).click()
  await expect(page.getByRole('row', { name: /Site purchase/ })).toHaveCount(0)
})

test('KAN-396 retains draft and requires reload on version conflict', async ({ page }) => {
  await mockApiRoute(page, '/v1/invoices/42', (route) => fulfillJson(route, 200, balancedInvoiceDetails))
  await mockApiRoute(page, '/v1/chart-of-accounts*', (route) => fulfillJson(route, 200, chartOfAccountsPage))
  await mockApiRoute(page, '/v1/accounting-entries/15/lines/151', (route) => fulfillJson(route, 409, { code: 'ACCOUNTING_ENTRY_MUTATION_CONFLICT', message: 'Another user changed this entry.' }))
  await page.goto('/invoices/42')
  await page.getByRole('tab', { name: 'Accounting' }).click()
  await page.getByRole('button', { name: 'Edit accounting line 1' }).click()
  await page.getByLabel('Line label').fill('Retained draft')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByLabel('Line label')).toHaveValue('Retained draft')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Reload entry' })).toBeVisible()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Line label')).toHaveValue('Retained draft')
})
