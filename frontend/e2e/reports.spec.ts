import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
} from './support/api'

const reportSummary = {
  period: {
    endDate: '2026-09-02',
    startDate: '2026-09-01',
  },
  totals: {
    invoiceCount: 45,
    totalHt: 100000,
    totalTtc: 120000,
    totalTva: 20000,
  },
  workQueues: {
    awaitingValidation: 12,
    exportable: 38,
    toProcess: 24,
    toVerify: 5,
  },
  alerts: {
    ocrErrors: 2,
    pendingDuplicates: 3,
    unbalancedAccountingEntries: 5,
  },
  statusDistribution: [
    { count: 24, status: 'DEPOSEE' },
    { count: 2, status: 'ERREUR_OCR' },
    { count: 12, status: 'A_VERIFIER' },
    { count: 38, status: 'EXPORTABLE' },
  ],
}

const organization = {
  organizationId: 1,
  name: 'Acme',
  legalName: 'Acme SAS',
  siret: '12345678901234',
  email: 'billing@acme.test',
  phone: null,
  address: null,
  defaultCurrencyCode: 'EUR',
}

const invoicePage = {
  content: [
    {
      currencyCode: 'EUR',
      dueDate: '2026-09-30',
      invoiceDate: '2026-09-01',
      invoiceId: 91,
      invoiceNumber: 'INV-2026-0912',
      status: 'A_VERIFIER',
      supplierName: 'Bouygues Construction',
      totalTtc: '12480.00',
    },
  ],
  number: 0,
  size: 8,
  totalElements: 1,
  totalPages: 1,
}

const supplierPage = {
  content: [
    {
      countryCode: 'FR',
      currentLegalIdentifiers: [],
      legalName: 'Bouygues Construction SAS',
      name: 'Bouygues Construction',
      siret: '57201524600017',
      supplierId: 42,
      tradeName: 'Bouygues Construction',
      vatNumber: 'FR73572015246',
    },
  ],
  number: 0,
  size: 8,
  totalElements: 1,
  totalPages: 1,
}

const projectSitePage = {
  content: [
    {
      active: true,
      classificationId: 42,
      createdAt: '2026-08-01T09:00:00',
      description: 'Residential construction project in Lyon.',
      name: 'Résidence Bellevue',
      type: 'CHANTIER',
      updatedAt: '2026-08-28T14:30:00',
    },
  ],
  number: 0,
  size: 8,
  totalElements: 1,
  totalPages: 1,
}

async function mockReportRequests(
  page: Page,
  summary: typeof reportSummary = reportSummary,
) {
  await mockApiRoute(page, '/v1/dashboard/summary*', async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(new URL(route.request().url()).searchParams.has('organizationId')).toBe(false)
    await fulfillJson(route, 200, summary)
  })
  await mockApiRoute(page, '/v1/organizations/current', async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    await fulfillJson(route, 200, organization)
  })
}

async function expectNoHorizontalOverflow(page: Page, surface: string) {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(
    layout.scrollWidth,
    `${surface} overflows by ${layout.scrollWidth - layout.clientWidth}px`,
  ).toBeLessThanOrEqual(layout.clientWidth)
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('renders the Figma report structure with real summary data and filtered links', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  await mockReportRequests(page)
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, invoicePage))

  await page.goto('/reports?period=current-month')

  await expect(page.getByRole('heading', { exact: true, name: 'Reports' })).toBeVisible()
  const processing = page.getByRole('region', { name: 'Invoice processing' })
  await expect(processing.getByText('Invoice volume')).toBeVisible()
  await expect(processing.getByText('45')).toBeVisible()
  await expect(processing.getByText('Waiting for approval')).toBeVisible()
  await expect(processing.getByText('12')).toBeVisible()

  const spending = page.getByRole('region', { name: 'Spending' })
  await expect(spending.getByText('€120,000').first()).toBeVisible()
  await expect(spending.getByText('€100,000').first()).toBeVisible()
  await expect(spending.getByText('€20,000').first()).toBeVisible()

  const operations = page.getByRole('region', { name: 'Operations' })
  await expect(operations.getByText('Possible duplicates')).toBeVisible()
  await expect(operations.getByText('Unbalanced entries')).toBeVisible()
  await expect(operations.getByRole('link', { name: 'Review OCR results' })).toHaveAttribute(
    'href',
    '/invoices?startDate=2026-09-01&endDate=2026-09-02&status=ERREUR_OCR',
  )

  await expect(page.getByRole('button', { name: 'Export report' })).toBeDisabled()
  await expect(page.getByRole('button', { exact: true, name: 'Supplier' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Project / Site' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Category' })).toBeDisabled()

  await processing.getByRole('link', { name: 'View approvals' }).click()
  await expect(page).toHaveURL(
    /\/invoices\?startDate=2026-09-01&endDate=2026-09-02&status=A_VERIFIER$/,
  )
  await expect(page.getByLabel('Filter by status')).toContainText('Waiting approval')
})

test('changes the report period without sending organization or mutation parameters', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  const summaryRequests: URL[] = []

  await mockApiRoute(page, '/v1/dashboard/summary*', async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().postData()).toBeNull()
    const url = new URL(route.request().url())
    summaryRequests.push(url)
    expect(url.searchParams.has('organizationId')).toBe(false)
    await fulfillJson(route, 200, {
      ...reportSummary,
      period: {
        endDate: url.searchParams.get('endDate'),
        startDate: url.searchParams.get('startDate'),
      },
    })
  })
  await mockApiRoute(page, '/v1/organizations/current', async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().postData()).toBeNull()
    await fulfillJson(route, 200, organization)
  })

  await page.goto('/reports?period=current-year')
  await expect(page.getByText('Invoice volume')).toBeVisible()

  const periodSelect = page.getByRole('combobox', { name: 'Report date range' })
  await expect(periodSelect).toContainText('Current year')
  await periodSelect.click()
  await page.getByRole('option', { name: 'Previous month' }).click()

  await expect(page).toHaveURL(/\/reports\?period=previous-month$/)
  await expect.poll(() => {
    const request = summaryRequests.at(-1)
    return {
      endDate: request?.searchParams.get('endDate'),
      startDate: request?.searchParams.get('startDate'),
    }
  }).toEqual({ endDate: '2026-08-31', startDate: '2026-08-01' })
})

test('covers the report loading and empty states', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  let releaseSummary: () => void = () => undefined
  const summaryGate = new Promise<void>((resolve) => {
    releaseSummary = resolve
  })

  await mockApiRoute(page, '/v1/dashboard/summary*', async (route) => {
    await summaryGate
    await fulfillJson(route, 200, {
      ...reportSummary,
      totals: {
        invoiceCount: 0,
        totalHt: 0,
        totalTtc: 0,
        totalTva: 0,
      },
    })
  })
  await mockApiRoute(page, '/v1/organizations/current', (route) => (
    fulfillJson(route, 200, organization)
  ))

  await page.goto('/reports?period=current-month')
  await expect(page.getByLabel('Loading reports')).toBeVisible()

  releaseSummary()

  await expect(page.getByRole('heading', { name: 'No report data for this period' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View invoices' })).toHaveAttribute(
    'href',
    '/invoices?startDate=2026-09-01&endDate=2026-09-02',
  )
})

test('keeps the report page available while retrying a request error', async ({ page }) => {
  let attempts = 0
  await mockApiRoute(page, '/v1/dashboard/summary*', async (route) => {
    attempts += 1
    await fulfillJson(route, attempts === 1 ? 503 : 200, attempts === 1 ? {} : reportSummary)
  })
  await mockApiRoute(page, '/v1/organizations/current', (route) => (
    fulfillJson(route, 200, organization)
  ))

  await page.goto('/reports')

  await expect(page.getByText('Unable to load reports')).toBeVisible()
  await expect(page.getByRole('heading', { exact: true, name: 'Reports' })).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Invoice volume')).toBeVisible()
  expect(attempts).toBe(2)
})

for (const width of [1440, 768, 390]) {
  test(`keeps reports, GED and directories readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width })
    await mockReportRequests(page)
    await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, invoicePage))
    await mockApiRoute(page, '/v1/invoices/*/preview', (route) => route.fulfill({
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFAgIACa4L9QAAAABJRU5ErkJggg==',
        'base64',
      ),
      contentType: 'image/png',
      status: 200,
    }))
    await mockApiRoute(page, '/v1/suppliers*', (route) => fulfillJson(route, 200, supplierPage))
    await mockApiRoute(page, '/v1/classifications*', (route) => (
      fulfillJson(route, 200, projectSitePage)
    ))

    await page.goto('/reports?period=current-month')
    await expect(page.getByText('Invoice volume')).toBeVisible()
    await expectNoHorizontalOverflow(page, 'Reports')

    await page.goto('/documents')
    await expect(page.getByRole('table')).toBeVisible()
    await expectNoHorizontalOverflow(page, 'Document table')

    await page.goto('/documents?view=grid')
    await expect(page.getByLabel('Document preview grid')).toBeVisible()
    await expectNoHorizontalOverflow(page, 'Document grid')

    await page.goto('/suppliers')
    await expect(page.getByRole('heading', { exact: true, name: 'Suppliers' })).toBeVisible()
    await expectNoHorizontalOverflow(page, 'Supplier directory')

    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: 'Projects & sites' })).toBeVisible()
    await expectNoHorizontalOverflow(page, 'Project directory')
  })
}
