import { expect, test } from '@playwright/test'

import {
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
} from './support/api'

const dashboardSummary = {
  period: {
    endDate: '2026-09-01',
    startDate: '2026-08-03',
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
    { count: 7, status: 'OCR_EN_COURS' },
    { count: 5, status: 'EXTRAITE' },
    { count: 12, status: 'A_VERIFIER' },
    { count: 18, status: 'VALIDEE' },
    { count: 38, status: 'EXPORTABLE' },
    { count: 142, status: 'EXPORTEE' },
  ],
}

const recentInvoicePage = {
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
    {
      currencyCode: 'EUR',
      dueDate: '2026-09-29',
      invoiceDate: '2026-08-31',
      invoiceId: 90,
      invoiceNumber: 'INV-2026-0911',
      status: 'EXTRAITE',
      supplierName: 'Saint-Gobain',
      totalTtc: '2340.80',
    },
  ],
  number: 0,
  size: 4,
  totalElements: 2,
  totalPages: 1,
}

async function mockDashboardRequests(page: Parameters<typeof mockCurrentUser>[0]) {
  await mockApiRoute(page, '/v1/dashboard/summary*', async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('startDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(url.searchParams.get('endDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await fulfillJson(route, 200, dashboardSummary)
  })
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, recentInvoicePage))
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('renders the Figma dashboard structure with API data', async ({ page }) => {
  await mockDashboardRequests(page)
  await page.setViewportSize({ height: 1024, width: 1440 })

  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  const indicators = page.getByRole('region', { name: 'Invoice indicators' })
  await expect(indicators.getByText('To process')).toBeVisible()
  await expect(indicators.getByText('24')).toBeVisible()
  await expect(indicators.getByText('Waiting for approval')).toBeVisible()
  await expect(indicators.getByText('12')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Invoice processing pipeline' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Attention required' })).toBeVisible()
  await expect(page.getByText('3 possible duplicate invoices detected')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent invoices' })).toBeVisible()
  await expect(page.getByText('Bouygues Construction')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Spending overview' })).toBeVisible()
  await expect(page.getByText('120,000').first()).toBeVisible()
  await expect(page.getByText('Activity feed unavailable')).toBeVisible()
})

test('opens the invoice list with the selected dashboard status', async ({ page }) => {
  await mockDashboardRequests(page)

  await page.goto('/dashboard')

  const indicators = page.getByRole('region', { name: 'Invoice indicators' })
  const statusLinks = indicators.getByRole('link', { name: 'View filtered list' })

  await expect(statusLinks).toHaveCount(3)
  await expect(statusLinks.nth(0)).toHaveAttribute('href', '/invoices?status=DEPOSEE')
  await expect(statusLinks.nth(1)).toHaveAttribute('href', '/invoices?status=A_VERIFIER')
  await expect(statusLinks.nth(2)).toHaveAttribute('href', '/invoices?status=EXPORTABLE')

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname.endsWith('/v1/invoices') && url.searchParams.get('status') === 'DEPOSEE'
  })

  await statusLinks.nth(0).click()
  await filteredRequest

  await expect(page).toHaveURL(/\/invoices\?status=DEPOSEE$/)
  await expect(page.getByLabel('Filter by status')).toContainText('To process')
})

test('keeps independent blocks visible when the summary is unavailable', async ({ page }) => {
  await mockApiRoute(page, '/v1/dashboard/summary*', (route) => fulfillJson(route, 503, {
    message: 'Summary temporarily unavailable',
  }))
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, recentInvoicePage))

  await page.goto('/dashboard')

  await expect(page.getByText('Invoice indicators are unavailable.')).toBeVisible()
  await expect(page.getByText('Bouygues Construction')).toBeVisible()
  await expect(page.getByText('Activity feed unavailable')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Upload invoice' })).toBeVisible()
})

test('keeps the dashboard readable at the Figma breakpoints', async ({ page }) => {
  await mockDashboardRequests(page)

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ height: 1000, width })
    await page.goto('/dashboard')
    await expect(page.getByText('Bouygues Construction')).toBeVisible()

    const viewportFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    )
    expect(viewportFits, `dashboard should not overflow at ${width}px`).toBe(true)

    const metricCards = page.getByRole('region', { name: 'Invoice indicators' }).locator(':scope > div')
    const firstCard = await metricCards.nth(0).boundingBox()
    const secondCard = await metricCards.nth(1).boundingBox()
    const thirdCard = await metricCards.nth(2).boundingBox()

    expect(firstCard).not.toBeNull()
    expect(secondCard).not.toBeNull()
    expect(thirdCard).not.toBeNull()

    if (width === 1440) {
      expect(secondCard?.y).toBe(firstCard?.y)
      expect(thirdCard?.y).toBe(firstCard?.y)
    } else if (width === 390) {
      expect(secondCard?.y).toBeGreaterThan(firstCard?.y ?? 0)
    } else {
      expect(secondCard?.y).toBe(firstCard?.y)
      expect(thirdCard?.y).toBeGreaterThan(firstCard?.y ?? 0)
    }
  }
})
