import { expect, test } from '@playwright/test'

import {
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
  currentUser,
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
    { count: 4, status: 'ARCHIVEE' },
    { count: 12, status: 'A_VERIFIER' },
    { count: 6, status: 'COMPTABILISEE' },
    { count: 24, status: 'DEPOSEE' },
    { count: 2, status: 'ERREUR_OCR' },
    { count: 38, status: 'EXPORTABLE' },
    { count: 142, status: 'EXPORTEE' },
    { count: 5, status: 'EXTRAITE' },
    { count: 7, status: 'OCR_EN_COURS' },
    { count: 1, status: 'REJETEE' },
    { count: 18, status: 'VALIDEE' },
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

const currentOrganization = {
  organizationId: 1,
  name: 'Acme',
  legalName: 'Acme SAS',
  siret: '12345678901234',
  email: 'billing@acme.test',
  phone: null,
  address: null,
  defaultCurrencyCode: 'EUR',
}

async function mockDashboardRequests(
  page: Parameters<typeof mockCurrentUser>[0],
  summary = dashboardSummary,
  currencyCode = currentOrganization.defaultCurrencyCode,
  invoices = recentInvoicePage,
) {
  await mockApiRoute(page, '/v1/dashboard/summary*', async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('startDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(url.searchParams.get('endDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await fulfillJson(route, 200, summary)
  })
  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const url = new URL(route.request().url())
    if (!url.pathname.endsWith('/v1/invoices')) {
      await route.fallback()
      return
    }

    if (url.searchParams.get('size') === '4') {
      expect(url.searchParams.get('startDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(url.searchParams.get('endDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    await fulfillJson(route, 200, invoices)
  })
  await mockApiRoute(page, '/v1/organizations/current', (route) => fulfillJson(route, 200, {
    ...currentOrganization,
    defaultCurrencyCode: currencyCode,
  }))
}

function waitForPeriodRequests(
  page: Parameters<typeof mockCurrentUser>[0],
  startDate: string,
  endDate: string,
) {
  const hasPeriod = (requestUrl: string, path: string) => {
    const url = new URL(requestUrl)
    return url.pathname.endsWith(path)
      && url.searchParams.get('startDate') === startDate
      && url.searchParams.get('endDate') === endDate
  }

  return Promise.all([
    page.waitForRequest((request) => hasPeriod(request.url(), '/v1/dashboard/summary')),
    page.waitForRequest((request) => hasPeriod(request.url(), '/v1/invoices')),
  ])
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
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  await mockDashboardRequests(page)

  await page.goto('/dashboard')

  const indicators = page.getByRole('region', { name: 'Invoice indicators' })
  const statusLinks = indicators.getByRole('link', { name: 'View filtered list' })
  const processingIssuesButton = indicators.getByRole('button', {
    name: 'View filtered list',
  })

  await expect(statusLinks).toHaveCount(2)
  await expect(statusLinks.nth(0)).toHaveAttribute(
    'href',
    '/invoices?status=DEPOSEE&startDate=2026-08-04&endDate=2026-09-02',
  )
  await expect(statusLinks.nth(1)).toHaveAttribute(
    'href',
    '/invoices?status=EXPORTABLE&startDate=2026-08-04&endDate=2026-09-02',
  )

  await processingIssuesButton.click()

  await expect(page).toHaveURL(/\/dashboard\?period=last-30-days#processing-issues$/)
  await expect(page.locator('#processing-issues')).toBeInViewport()

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname.endsWith('/v1/invoices') && url.searchParams.get('status') === 'DEPOSEE'
  })

  await statusLinks.nth(0).click()
  await filteredRequest

  await expect(page).toHaveURL(
    /\/invoices\?status=DEPOSEE&startDate=2026-08-04&endDate=2026-09-02$/,
  )
  await expect(page.getByLabel('Filter by status')).toContainText('To process')
  await expect(page.getByText('Invoice period: 4 Aug 2026 – 2 Sept 2026')).toBeVisible()
})

test('only offers dashboard queue actions allowed for the current role', async ({ page }) => {
  await page.unroute('**/api/v1/users/me')
  await mockCurrentUser(page, {
    ...currentUser,
    role: {
      ...currentUser.role,
      code: 'RESPONSABLE_COMPTABLE',
      label: 'Accounting manager',
    },
  })
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  await mockDashboardRequests(page)

  await page.goto('/dashboard')

  const indicators = page.getByRole('region', { name: 'Invoice indicators' })
  const toProcessCard = indicators.getByText('To process').locator('..')
  const approvalCard = indicators.getByText('Waiting for approval').locator('..')
  const exportCard = indicators.getByText('Ready to export').locator('..')

  await expect(toProcessCard.getByRole('link', { name: 'View filtered list' })).toHaveCount(0)
  await expect(approvalCard.getByRole('link', { name: 'View filtered list' })).toHaveAttribute(
    'href',
    '/invoices?status=A_VERIFIER&startDate=2026-08-04&endDate=2026-09-02',
  )
  await expect(exportCard.getByRole('link', { name: 'View filtered list' })).toHaveAttribute(
    'href',
    '/invoices?status=EXPORTABLE&startDate=2026-08-04&endDate=2026-09-02',
  )
})

test('opens recent invoices and the complete invoice list', async ({ page }) => {
  await mockDashboardRequests(page)

  await page.goto('/dashboard')

  const recentInvoices = page.getByRole('region', { name: 'Recent invoices' })
  await expect(recentInvoices.getByRole('link', { name: 'View all' }))
    .toHaveAttribute('href', '/invoices')

  await recentInvoices.getByRole('link', { name: 'Open invoice INV-2026-0912' }).click()

  await expect(page).toHaveURL(/\/invoices\/91$/)
})

test('shows spending totals with the organization currency and selected period', async ({ page }) => {
  await mockDashboardRequests(page, dashboardSummary, 'GBP')

  await page.goto('/dashboard')

  const spending = page.getByRole('region', { name: 'Spending overview' })
  await expect(spending.getByText('£120,000').first()).toBeVisible()
  await expect(spending.getByText(/3 Aug 2026 .* 1 Sept 2026/)).toBeVisible()
  await expect(spending.getByRole('link', { name: 'View report' }))
    .toHaveAttribute('href', '/reports')
})

test('applies every calendar period preset to the dashboard requests', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  await mockDashboardRequests(page)

  const defaultRequests = waitForPeriodRequests(page, '2026-08-04', '2026-09-02')
  await page.goto('/dashboard')
  await defaultRequests

  const periodSelect = page.getByRole('combobox', { name: 'Dashboard period' })
  await expect(periodSelect).toContainText('Last 30 days')
  await expect(page).toHaveURL(/\/dashboard\?period=last-30-days$/)

  const calendarBox = await periodSelect.locator('svg').first().boundingBox()
  const periodLabelBox = await periodSelect.getByText('Last 30 days').boundingBox()
  expect(calendarBox).not.toBeNull()
  expect(periodLabelBox).not.toBeNull()
  expect((calendarBox?.x ?? 0) + (calendarBox?.width ?? 0))
    .toBeLessThan(periodLabelBox?.x ?? 0)
  expect(Math.abs(
    (calendarBox?.y ?? 0) + (calendarBox?.height ?? 0) / 2
    - (periodLabelBox?.y ?? 0) - (periodLabelBox?.height ?? 0) / 2,
  )).toBeLessThan(2)

  const presets = [
    { endDate: '2026-09-02', label: 'Last 12 months', startDate: '2025-10-01', value: 'last-12-months' },
    { endDate: '2026-09-02', label: 'Current month', startDate: '2026-09-01', value: 'current-month' },
    { endDate: '2026-08-31', label: 'Previous month', startDate: '2026-08-01', value: 'previous-month' },
    { endDate: '2026-09-02', label: 'Last 90 days', startDate: '2026-06-05', value: 'last-90-days' },
    { endDate: '2026-09-02', label: 'Current year', startDate: '2026-01-01', value: 'current-year' },
  ]

  for (const preset of presets) {
    const requests = waitForPeriodRequests(page, preset.startDate, preset.endDate)
    await periodSelect.click()
    await page.getByRole('option', { name: preset.label }).click()
    await requests

    await expect(periodSelect).toContainText(preset.label)
    await expect(page).toHaveURL(new RegExp(`period=${preset.value}$`))
  }
})

test('restores the selected period from the URL and browser history', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  await mockDashboardRequests(page)

  let requests = waitForPeriodRequests(page, '2026-09-01', '2026-09-02')
  await page.goto('/dashboard?period=current-month')
  await requests

  const periodSelect = page.getByRole('combobox', { name: 'Dashboard period' })
  await expect(periodSelect).toContainText('Current month')

  requests = waitForPeriodRequests(page, '2026-09-01', '2026-09-02')
  await page.reload()
  await requests
  await expect(periodSelect).toContainText('Current month')

  requests = waitForPeriodRequests(page, '2026-08-01', '2026-08-31')
  await periodSelect.click()
  await page.getByRole('option', { name: 'Previous month' }).click()
  await requests

  requests = waitForPeriodRequests(page, '2026-09-01', '2026-09-02')
  await page.goBack()
  await requests
  await expect(periodSelect).toContainText('Current month')
})

test('falls back to the default period for an invalid URL value', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  await mockDashboardRequests(page)

  const requests = waitForPeriodRequests(page, '2026-08-04', '2026-09-02')
  await page.goto('/dashboard?period=unsupported')
  await requests

  await expect(page.getByRole('combobox', { name: 'Dashboard period' }))
    .toContainText('Last 30 days')
  await expect(page).toHaveURL(/\/dashboard\?period=last-30-days$/)
})

test('keeps the selected period visible when it contains no invoices', async ({ page }) => {
  const emptySummary = {
    ...dashboardSummary,
    totals: {
      invoiceCount: 0,
      totalHt: 0,
      totalTtc: 0,
      totalTva: 0,
    },
    statusDistribution: dashboardSummary.statusDistribution.map((status) => ({
      ...status,
      count: 0,
    })),
  }
  const emptyInvoices = {
    ...recentInvoicePage,
    content: [],
    totalElements: 0,
  }
  await mockDashboardRequests(page, emptySummary, 'EUR', emptyInvoices)

  await page.goto('/dashboard?period=current-year')

  await expect(page.getByRole('combobox', { name: 'Dashboard period' }))
    .toContainText('Current year')
  await expect(page.getByText('No invoices in the selected period.')).toBeVisible()
  await expect(page.getByText('No invoices in this workspace yet.')).toBeVisible()
})

test('links every pipeline step to its exact invoice status', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  await mockDashboardRequests(page)

  await page.goto('/dashboard')

  const pipeline = page.getByRole('region', { name: 'Invoice processing pipeline' })
  const expectedSteps = [
    ['To process', 'DEPOSEE'],
    ['Processing', 'OCR_EN_COURS'],
    ['Needs review', 'EXTRAITE'],
    ['Waiting for approval', 'A_VERIFIER'],
    ['Approved', 'VALIDEE'],
    ['Ready to export', 'EXPORTABLE'],
    ['Exported', 'EXPORTEE'],
  ]

  await expect(pipeline.getByRole('link', { name: 'View invoices', exact: true }))
    .toHaveAttribute('href', '/invoices')

  for (const [label, status] of expectedSteps) {
    await expect(pipeline.getByRole('link', { name: `View ${label} invoices` }))
      .toHaveAttribute(
        'href',
        `/invoices?status=${status}&startDate=2026-08-04&endDate=2026-09-02`,
      )
  }

  await expect(pipeline.getByText('Archived')).toHaveCount(0)
  await expect(pipeline.getByText('OCR error')).toHaveCount(0)

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname.endsWith('/v1/invoices') && url.searchParams.get('status') === 'EXTRAITE'
  })

  await pipeline.getByRole('link', { name: 'View Needs review invoices' }).click()
  await filteredRequest

  await expect(page).toHaveURL(
    /\/invoices\?status=EXTRAITE&startDate=2026-08-04&endDate=2026-09-02$/,
  )
  await expect(page.getByLabel('Filter by status')).toContainText('Needs review')
  await expect(page.getByText('Invoice period: 4 Aug 2026 – 2 Sept 2026')).toBeVisible()
})

test('shows the pipeline empty state when every lifecycle count is zero', async ({ page }) => {
  const emptySummary = {
    ...dashboardSummary,
    statusDistribution: dashboardSummary.statusDistribution.map((status) => ({
      ...status,
      count: 0,
    })),
  }
  await mockDashboardRequests(page, emptySummary)

  await page.goto('/dashboard')

  const pipeline = page.getByRole('region', { name: 'Invoice processing pipeline' })
  await expect(pipeline.getByText('No invoices in the selected period.')).toBeVisible()
  await expect(pipeline.getByRole('link', { name: /^View .+ invoices$/ })).toHaveCount(0)
})

test('keeps independent blocks visible when the summary is unavailable', async ({ page }) => {
  await mockApiRoute(page, '/v1/dashboard/summary*', (route) => fulfillJson(route, 503, {
    message: 'Summary temporarily unavailable',
  }))
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, recentInvoicePage))
  await mockApiRoute(page, '/v1/organizations/current', (route) => fulfillJson(
    route,
    200,
    currentOrganization,
  ))

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

test('opens the explicit global search state from the header and keyboard', async ({ page }) => {
  await mockDashboardRequests(page)
  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto('/dashboard')

  await page.locator('header').getByRole('button', { name: 'Search…' }).click()

  const searchDialog = page.getByRole('dialog', { name: 'Global search' })
  await expect(searchDialog).toBeVisible()
  await expect(searchDialog.getByText('Global search is not available yet.')).toBeVisible()
  await expect(searchDialog.getByRole('link', { name: 'Search invoices' }))
    .toHaveAttribute('href', '/invoices')
  await expect(searchDialog.getByRole('link', { name: 'Search suppliers' }))
    .toHaveAttribute('href', '/suppliers')
  await expect(searchDialog.getByRole('link', { name: 'Search documents' }))
    .toHaveAttribute('href', '/documents')

  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+k')
  await expect(searchDialog).toBeVisible()
})

test('loads the current user notifications and marks one as read', async ({ page }) => {
  const unreadTotals: number[] = []
  const notifications = [
    {
      notificationId: 81,
      type: 'PENDING_VALIDATION',
      message: 'Invoice INV-2026-081 is ready for review.',
      invoiceId: null,
      read: false,
      readAt: null as string | null,
      createdAt: '2026-09-07T09:15:00',
    },
    {
      notificationId: 80,
      type: 'OCR_ERROR',
      message: 'Invoice INV-2026-080 could not be processed.',
      invoiceId: 80,
      read: false,
      readAt: null as string | null,
      createdAt: '2026-09-06T16:45:00',
    },
  ]

  await page.unroute('**/api/v1/notifications*')
  await mockApiRoute(page, '/v1/notifications?*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
    const content = unreadOnly ? notifications.filter((notification) => !notification.read) : notifications
    if (unreadOnly) {
      unreadTotals.push(content.length)
    }
    await fulfillJson(route, 200, {
      content: content.slice(0, Number(url.searchParams.get('size') ?? 20)),
      number: 0,
      size: Number(url.searchParams.get('size') ?? 20),
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
    })
  })
  await mockApiRoute(page, '/v1/notifications/81/read', async (route) => {
    notifications[0] = {
      ...notifications[0],
      read: true,
      readAt: '2026-09-07T10:00:00',
    }
    await fulfillJson(route, 200, notifications[0])
  })
  await mockDashboardRequests(page)
  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto('/dashboard')

  const notificationTrigger = page.locator('header').getByRole('button', {
    name: 'Notifications, 2 unread',
  })
  await expect(notificationTrigger).toBeVisible()
  await notificationTrigger.click()

  const notificationSheet = page.getByRole('dialog', { name: 'Notifications' })
  await expect(notificationSheet).toBeVisible()
  await expect(notificationSheet.getByText('Invoice INV-2026-081 is ready for review.'))
    .toBeVisible()
  await expect(notificationSheet.getByText('Showing 2 of 2 notifications')).toBeVisible()

  const readRequest = page.waitForRequest((request) =>
    request.method() === 'PATCH'
      && request.url().endsWith('/api/v1/notifications/81/read'),
  )
  await notificationSheet.getByRole('button', {
    name: 'Unread notification — Invoice ready for review: Invoice INV-2026-081 is ready for review.',
  }).click()
  await readRequest
  await expect(notificationSheet.getByRole('button', {
    name: 'Read notification — Invoice ready for review: Invoice INV-2026-081 is ready for review.',
  })).toBeVisible()
  await expect.poll(() => unreadTotals.at(-1)).toBe(1)
  await page.keyboard.press('Escape')

  await expect(page.locator('header').getByRole('button', {
    name: 'Notifications, 1 unread',
  })).toBeVisible()
})

test('keeps global controls usable at the Figma breakpoints', async ({ page }) => {
  await mockDashboardRequests(page)

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ height: 900, width })
    await page.goto('/dashboard')

    const header = page.locator('header')
    await header.getByRole('button', { name: 'Notifications' }).click()

    const notificationSheet = page.getByRole('dialog', { name: 'Notifications' })
    await expect(notificationSheet).toBeVisible()
    const notificationBox = await notificationSheet.boundingBox()
    expect(notificationBox).not.toBeNull()
    expect(notificationBox?.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')

    await header.getByRole('button', { name: width === 1440 ? 'Search…' : 'Search' }).click()
    const searchDialog = page.getByRole('dialog', { name: 'Global search' })
    await expect(searchDialog).toBeVisible()

    const viewportFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    )
    expect(viewportFits, `global controls should not overflow at ${width}px`).toBe(true)
    await page.keyboard.press('Escape')
  }
})
