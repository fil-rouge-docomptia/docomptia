import { expect, test } from '@playwright/test'

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

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page, validator)
})

test('loads the secured approval queue and opens the selected invoice', async ({ page }) => {
  const requestedUrls: URL[] = []

  await mockApiRoute(page, '/v1/invoices/pending-validation*', async (route) => {
    requestedUrls.push(new URL(route.request().url()))
    await fulfillJson(route, 200, approvalPage)
  })

  await page.goto('/approvals')

  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible()
  await expect(page.getByText('Acme Supplies')).toBeVisible()
  await expect(page.getByText('Waiting approval').first()).toBeVisible()
  await expect(page.getByText('1–8 of 10 invoices')).toBeVisible()
  await expect(page.getByText('€3,750.50')).toBeVisible()

  const initialRequest = requestedUrls.at(-1)
  expect(initialRequest?.pathname).toBe('/api/v1/invoices/pending-validation')
  expect(initialRequest?.searchParams.get('page')).toBe('0')
  expect(initialRequest?.searchParams.get('size')).toBe('8')
  expect(initialRequest?.searchParams.get('sortBy')).toBe('invoiceDate')
  expect(initialRequest?.searchParams.get('direction')).toBe('ASC')
  expect(initialRequest?.searchParams.has('status')).toBe(false)

  await page.getByRole('link', { name: 'Open invoice INV-2026-0042' }).click()
  await expect(page).toHaveURL(/\/invoices\/42$/)
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
