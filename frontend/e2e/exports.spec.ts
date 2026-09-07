import { expect, test } from '@playwright/test'
import type { ExportBatch, ExportCandidate, ExportSelection } from '../src/types/export'
import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const root = '/v1/accounting-exports'
const invoices: ExportCandidate[] = [
  { invoiceId: 41, invoiceNumber: 'INV-2026-041', invoiceDate: '2026-08-01', supplierName: 'Acme Supplies', currencyCode: 'EUR', invoiceAmount: 120, eligible: true, totalDebit: 120, totalCredit: 120, errors: [] },
  { invoiceId: 42, invoiceNumber: 'INV-2026-042', invoiceDate: '2026-08-31', supplierName: 'Global Supplies', currencyCode: 'USD', invoiceAmount: 240, eligible: true, totalDebit: 240, totalCredit: 240, errors: [] },
  { invoiceId: 43, invoiceNumber: 'INV-2026-043', invoiceDate: '2026-08-15', supplierName: 'Other Supplies', currencyCode: 'EUR', invoiceAmount: 99, eligible: false, totalDebit: null, totalCredit: null, errors: [{ code: 'ACCOUNTING_ENTRY_MISSING', message: 'The invoice has no accounting entry' }] },
]
const selection: ExportSelection = {
  organizationId: 1, organizationName: 'Acme', startDate: null, endDate: null, invoices,
  totals: [
    { currencyCode: 'EUR', totalDebit: 120, totalCredit: 120, invoiceAmount: 120 },
    { currencyCode: 'USD', totalDebit: 240, totalCredit: 240, invoiceAmount: 240 },
  ],
}
const batches: ExportBatch[] = Array.from({ length: 8 }, (_, index) => ({
  exportBatchId: 84 - index, createdAt: '2026-09-01T10:00:00', periodStartDate: '2026-08-01', periodEndDate: '2026-08-31',
  format: index % 2 ? 'FEC' : 'CSV', status: index === 7 ? 'PREPARATION' : index === 6 ? 'ARCHIVE' : 'GENERE',
  fileName: index % 2 ? '123456789FEC20260831.txt' : 'accounting-20260831.csv', createdByName: 'Alex Martin', invoiceCount: 2,
  amounts: [{ currencyCode: 'EUR', amount: 12450.50 }], downloadable: index !== 7,
}))
const history = { content: batches, number: 0, size: 8, totalElements: 16, totalPages: 2 }
const summary = { readyToExport: 2, blockedInvoices: 1, exportedThisMonth: 8, monthStart: '2026-09-01', monthEnd: '2026-09-30' }

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, `${root}?*`, (route) => fulfillJson(route, 200, history))
  await mockApiRoute(page, `${root}/summary`, (route) => fulfillJson(route, 200, summary))
  await mockApiRoute(page, `${root}/selection?*`, (route) => {
    const params = new URL(route.request().url()).searchParams
    return fulfillJson(route, 200, { ...selection, startDate: params.get('startDate'), endDate: params.get('endDate') })
  })
  await mockApiRoute(page, `${root}/selection/confirm`, (route) => {
    const body = route.request().postDataJSON() as { invoiceIds: number[]; startDate: string | null; endDate: string | null }
    const selected = invoices.filter((invoice) => body.invoiceIds.includes(invoice.invoiceId))
    return fulfillJson(route, 200, { ...selection, startDate: body.startDate, endDate: body.endDate, invoices: selected,
      totals: selection.totals.filter((total) => selected.some((invoice) => invoice.currencyCode === total.currencyCode)) })
  })
})

test('center shows actual metrics, history statuses and navigation to eligible invoices', async ({ page }) => {
  await page.goto('/exports')
  await expect(page.getByRole('heading', { name: 'Exports', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Export overview' })).toContainText('2')
  const table = page.getByRole('table', { name: 'Export history' })
  await expect(table.getByText('12,450.50 EUR').first()).toBeVisible()
  await expect(table.getByText('Archived', { exact: true })).toBeVisible()
  await expect(table.getByRole('button', { name: 'Download export 77' })).toBeDisabled()
  await page.getByRole('link', { name: 'Open queue' }).click()
  await expect(page).toHaveURL('/exports/new?eligibility=ready')
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-2026-043' })).toHaveCount(0)
})

test('history sends authenticated combined filters and resets pagination', async ({ page }) => {
  const requests: URL[] = []
  await mockApiRoute(page, `${root}?*`, async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    requests.push(new URL(route.request().url()))
    await fulfillJson(route, 200, history)
  })
  await page.goto('/exports?page=2&organizationId=999')
  await page.getByRole('combobox', { name: 'Export status' }).click()
  await page.getByRole('option', { name: 'Archived', exact: true }).click()
  await page.getByRole('combobox', { name: 'Export format' }).click()
  await page.getByRole('option', { name: 'FEC', exact: true }).click()
  await page.getByLabel('Created from').fill('2026-08-01')
  await page.getByLabel('Created through').fill('2026-08-31')
  await page.getByLabel('Search exports', { exact: true }).fill('  august  ')
  await expect.poll(() => requests.at(-1)?.searchParams.get('query')).toBe('august')
  expect(Object.fromEntries(requests.at(-1)!.searchParams)).toEqual({ size: '8', query: 'august', status: 'ARCHIVE', format: 'FEC', startDate: '2026-08-01', endDate: '2026-08-31', page: '0' })
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).toHaveURL('/exports')
})

test('history pagination follows the URL and ignores late responses after back navigation', async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, `${root}?*`, async (route) => {
    const second = new URL(route.request().url()).searchParams.get('page') === '1'
    if (second) await pending
    await fulfillJson(route, 200, { ...history, number: second ? 1 : 0, content: [{ ...batches[0], exportBatchId: second ? 900 : 84 }] })
  })
  await page.goto('/exports')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('status', { name: 'Loading export history' })).toBeVisible()
  await page.goBack()
  release()
  await expect(page.getByRole('table')).toContainText('#84')
  await expect(page.getByText('#900', { exact: true })).toHaveCount(0)
})

for (const [status, message] of [[403, 'Export access denied'], [404, 'Exports unavailable'], [500, 'Unable to load exports']] as const) {
  for (const routePath of ['/exports', '/exports/new']) {
    test(`${routePath} handles API ${status}`, async ({ page }) => {
      await mockApiRoute(page, routePath === '/exports' ? `${root}?*` : `${root}/selection?*`, (route) => fulfillJson(route, status, {}))
      await page.goto(routePath)
      await expect(page.getByText(message, { exact: true })).toBeVisible()
      if (status === 500) {
        await mockApiRoute(page, routePath === '/exports' ? `${root}?*` : `${root}/selection?*`, (route) => fulfillJson(route, 200, routePath === '/exports' ? history : selection))
        await page.getByRole('button', { name: 'Try again' }).click()
        await expect(page.getByRole('table')).toBeVisible()
      } else await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    })
  }
}

test('a summary failure does not hide working history or invent zero metrics', async ({ page }) => {
  await mockApiRoute(page, `${root}/summary`, (route) => fulfillJson(route, 500, {}))
  await page.goto('/exports')
  await expect(page.getByRole('table', { name: 'Export history' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Export overview' })).toHaveCount(0)
  await mockApiRoute(page, `${root}/summary`, (route) => fulfillJson(route, 200, { ...summary, readyToExport: 0 }))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('region', { name: 'Export overview' })).toContainText('0')
})

test('empty history and out of range pages offer an honest recovery', async ({ page }) => {
  await mockApiRoute(page, `${root}?*`, (route) => fulfillJson(route, 200, { ...history, content: [], totalElements: 0, totalPages: 0 }))
  await page.goto('/exports')
  await expect(page.getByRole('heading', { name: 'No exports yet' })).toBeVisible()
  await page.goto('/exports?page=9')
  await page.getByRole('button', { name: 'Back to first page' }).click()
  await expect(page).toHaveURL('/exports?page=1')
})

test('downloads the authenticated file without generating another export', async ({ page }) => {
  let downloads = 0
  await mockApiRoute(page, `${root}/84/file`, async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    downloads++
    await route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'access-control-allow-origin': '*' }, body: 'Invoice,Amount\n41,120.00' })
  })
  await page.goto('/exports')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download export 84' }).click()
  expect((await downloadEvent).suggestedFilename()).toBe('accounting-20260831.csv')
  expect(downloads).toBe(1)
})

for (const status of [403, 404, 500]) {
  test(`download reports ${status} without reporting success`, async ({ page }) => {
    await mockApiRoute(page, `${root}/84/file`, (route) => fulfillJson(route, status, {}))
    await page.goto('/exports')
    await page.getByRole('button', { name: 'Download export 84' }).click()
    await expect(page.getByRole('alert')).toContainText(status === 403 ? 'Download access denied' : status === 404 ? 'Export file not found' : 'Download failed')
  })
}

test('selection disables blocked invoices and empty continuation; totals stay separate by currency', async ({ page }) => {
  await page.goto('/exports/new?startDate=2026-08-01&endDate=2026-08-31')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Scope', { exact: true })).toHaveText('Acme · All invoices')
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-2026-043' })).toBeDisabled()
  await expect(page.getByText('The invoice has no accounting entry')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Select eligible invoices on this page' }).check()
  await expect(page.getByText('2 invoices selected', { exact: true })).toBeVisible()
  const totals = page.getByLabel('Selection totals', { exact: true })
  await expect(totals.getByText('120.00 EUR', { exact: true })).toHaveCount(3)
  await expect(totals.getByText('240.00 USD', { exact: true })).toHaveCount(3)
  await expect(totals).not.toContainText('360.00')
  await page.getByRole('checkbox', { name: 'Select invoice INV-2026-042' }).uncheck()
  await expect(page.getByRole('checkbox', { name: 'Select eligible invoices on this page' })).toHaveAttribute('data-state', 'indeterminate')
  await expect(totals.getByText('240.00 USD', { exact: true })).toHaveCount(0)
})

test('confirmation posts exactly the selected IDs and waits for the server response', async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  let requests = 0
  await mockApiRoute(page, `${root}/selection/confirm`, async (route) => {
    requests++
    expect(route.request().postDataJSON()).toEqual({ invoiceIds: [41], startDate: '2026-08-01', endDate: '2026-08-31' })
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    await pending
    await fulfillJson(route, 200, { ...selection, startDate: '2026-08-01', endDate: '2026-08-31', invoices: [invoices[0]], totals: [selection.totals[0]] })
  })
  await page.goto('/exports/new?startDate=2026-08-01&endDate=2026-08-31&organizationId=999')
  const checkbox = page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' })
  await checkbox.focus()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Checking selection…' })).toBeDisabled()
  await expect(checkbox).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'Selection prepared' })).toHaveCount(0)
  release()
  await expect(page.getByRole('heading', { name: 'Selection prepared' })).toBeFocused()
  await expect(page.getByLabel('Confirmed invoices')).toContainText('INV-2026-041')
  await expect(page.getByText('Your selection has been checked. No export file has been generated.')).toBeVisible()
  expect(requests).toBe(1)
  await page.getByRole('button', { name: 'Edit selection' }).click()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
})

test('selection persists across pages and selecting a page never selects hidden rows', async ({ page }) => {
  const many = Array.from({ length: 10 }, (_, index) => ({ ...invoices[0], invoiceId: 100 + index, invoiceNumber: `MANY-${index}` }))
  await mockApiRoute(page, `${root}/selection?*`, (route) => fulfillJson(route, 200, { ...selection, invoices: many }))
  await page.goto('/exports/new')
  await page.getByRole('checkbox', { name: 'Select eligible invoices on this page' }).check()
  await expect(page.getByText('8 invoices selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('checkbox', { name: 'Select invoice MANY-8', exact: true })).not.toBeChecked()
  await page.getByRole('checkbox', { name: 'Select invoice MANY-9', exact: true }).check()
  await expect(page.getByText('9 invoices selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page.getByRole('checkbox', { name: 'Select invoice MANY-0', exact: true })).toBeChecked()
})

test('changing dates or eligibility clears a previous selection', async ({ page }) => {
  await page.goto('/exports/new')
  await page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' }).check()
  await page.getByLabel('Invoice date from').fill('2026-08-01')
  await expect(page.getByText('0 invoices selected', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' }).check()
  await page.getByRole('combobox', { name: 'Invoice eligibility' }).click()
  await page.getByRole('option', { name: 'Blocked invoices', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-2026-043' })).toBeDisabled()
})

test('late candidate responses cannot restore the previous period or its selection', async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, `${root}/selection?*`, async (route) => {
    const date = new URL(route.request().url()).searchParams.get('startDate')
    if (!date) await pending
    await fulfillJson(route, 200, { ...selection, invoices: date ? [invoices[1]] : [invoices[0]] })
  })
  await page.goto('/exports/new')
  await expect(page.getByRole('status', { name: 'Loading eligible invoices' })).toBeVisible()
  await page.getByLabel('Invoice date from').fill('2026-08-02')
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-2026-042' })).toBeVisible()
  release()
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
})

test('leaving during confirmation prevents a late response from restoring the selection screen', async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, `${root}/selection/confirm`, async (route) => {
    await pending
    await fulfillJson(route, 200, selection)
  })
  await page.goto('/exports/new')
  await page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Checking selection…' })).toBeVisible()
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  release()
  await expect(page.getByRole('heading', { name: 'Exports', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Selection prepared' })).toHaveCount(0)
})

test('confirmation displays server totals when amounts have changed since loading', async ({ page }) => {
  await mockApiRoute(page, `${root}/selection/confirm`, (route) => fulfillJson(route, 200, {
    ...selection, invoices: [{ ...invoices[0], invoiceAmount: 121 }],
    totals: [{ currencyCode: 'EUR', totalDebit: 121, totalCredit: 121, invoiceAmount: 121 }],
  }))
  await page.goto('/exports/new')
  await page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Selection prepared' })).toBeVisible()
  await expect(page.getByLabel('Selection totals').getByText('121.00 EUR', { exact: true })).toHaveCount(3)
})

for (const path of ['/exports', '/exports/new']) {
  test(`${path} rejects an invalid period without querying the list`, async ({ page }) => {
    let calls = 0
    await mockApiRoute(page, path === '/exports' ? `${root}?*` : `${root}/selection?*`, async (route) => { calls++; await fulfillJson(route, 200, {}) })
    await page.goto(`${path}?startDate=2026-09-01&endDate=2026-08-01`)
    await expect(page.getByRole('alert')).toContainText('The start date must be on or before the end date.')
    expect(calls).toBe(0)
    if (path.endsWith('/new')) await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  })
}

test('a stale selection is rejected, cleared and reloaded before another confirmation', async ({ page }) => {
  await page.goto('/exports/new')
  await page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' }).check()
  await mockApiRoute(page, `${root}/selection?*`, (route) => fulfillJson(route, 200, { ...selection, invoices: [invoices[2]] }))
  await mockApiRoute(page, `${root}/selection/confirm`, (route) => fulfillJson(route, 409, { code: 'ACCOUNTING_EXPORT_VALIDATION_ERROR' }))
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Review the refreshed invoices')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Selection prepared' })).toHaveCount(0)
})

for (const status of [403, 404, 500]) {
  test(`confirmation handles ${status} without optimistic success`, async ({ page }) => {
    await mockApiRoute(page, `${root}/selection/confirm`, (route) => fulfillJson(route, status, {}))
    await page.goto('/exports/new')
    await page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' }).check()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Selection not confirmed')
    await expect(page.getByRole('heading', { name: 'Selection prepared' })).toHaveCount(0)
    if (status !== 500) await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
    else {
      await mockApiRoute(page, `${root}/selection/confirm`, (route) => fulfillJson(route, 200, { ...selection, invoices: [invoices[0]], totals: [selection.totals[0]] }))
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Selection prepared' })).toBeVisible()
    }
  })
}

test('empty candidate list cannot be confirmed and cancellation makes no business request', async ({ page }) => {
  let mutations = 0
  page.on('request', (request) => { if (request.method() === 'POST') mutations++ })
  await mockApiRoute(page, `${root}/selection?*`, (route) => fulfillJson(route, 200, { ...selection, invoices: [], totals: [] }))
  await page.goto('/exports/new')
  await expect(page.getByRole('heading', { name: 'No matching invoices' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL('/exports')
  expect(mutations).toBe(0)
})

for (const path of ['/exports', '/exports/new']) {
  test(`${path} expires the session on 401`, async ({ page }) => {
    await mockApiRoute(page, path === '/exports' ? `${root}?*` : `${root}/selection?*`, (route) => fulfillJson(route, 401, {}))
    await page.goto(path)
    await expect(page).toHaveURL(/\/login/)
  })
}

for (const role of ['ADMIN', 'OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`${role} uses the export workflow under the current MVP permissions`, async ({ page }) => {
    await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code: role } })
    await page.goto('/exports')
    await page.getByRole('link', { name: 'Create export', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Select invoice INV-2026-041' }).check()
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()
  })
}

for (const width of [1440, 768, 390]) {
  for (const view of ['center', 'selection']) {
    test(`${view} remains usable at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1024 })
      await page.goto(view === 'center' ? '/exports' : '/exports/new?startDate=2026-08-01&endDate=2026-08-31')
      await expect(page.getByRole('table')).toBeVisible()
      if (view === 'selection') await page.getByRole('checkbox', { name: 'Select eligible invoices on this page' }).check()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`), fullPage: true })
    })
  }
}
