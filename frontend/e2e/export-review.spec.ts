import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ExportFormat, ExportSelection } from '../src/types/export'
import { fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const root = '/v1/accounting-exports'
const selection: ExportSelection = {
  organizationId: 1, organizationName: 'Acme', startDate: '2026-08-01', endDate: '2026-08-31',
  invoices: [
    { invoiceId: 41, invoiceNumber: 'INV-041', invoiceDate: '2026-08-01', supplierName: 'Acme Supplies', currencyCode: 'EUR', invoiceAmount: 120, eligible: true, totalDebit: 120, totalCredit: 120, errors: [] },
    { invoiceId: 42, invoiceNumber: 'INV-042', invoiceDate: '2026-08-31', supplierName: 'Global Supplies', currencyCode: 'USD', invoiceAmount: 240, eligible: true, totalDebit: 240, totalCredit: 240, errors: [] },
  ],
  totals: [{ currencyCode: 'EUR', invoiceAmount: 120, totalDebit: 120, totalCredit: 120 }, { currencyCode: 'USD', invoiceAmount: 240, totalDebit: 240, totalCredit: 240 }],
}
const report = { code: 'ACCOUNTING_EXPORT_VALIDATION_FAILED', invoices: [
  { invoiceId: 41, invoiceNumber: 'INV-041', errors: [{ code: 'FEC_TEXT_INVALID', message: 'The accounting entry label contains a forbidden control character' }, { code: 'FEC_ORGANIZATION_SIRET_INVALID', message: 'The organization must have a valid SIRET' }] },
  { invoiceId: 42, invoiceNumber: 'INV-042', errors: [{ code: 'ACCOUNT_INACTIVE', message: 'Account 607000 is inactive' }] },
] }

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, `${root}?*`, (route) => fulfillJson(route, 200, { content: [], number: 0, size: 8, totalElements: 0, totalPages: 0 }))
  await mockApiRoute(page, `${root}/summary`, (route) => fulfillJson(route, 200, { readyToExport: 2, blockedInvoices: 0, exportedThisMonth: 0, monthStart: '2026-09-01', monthEnd: '2026-09-30' }))
  await mockApiRoute(page, `${root}/selection?*`, (route) => fulfillJson(route, 200, selection))
  await mockApiRoute(page, `${root}/selection/confirm`, (route) => fulfillJson(route, 200, selection))
  await mockApiRoute(page, `${root}/formats`, (route) => fulfillJson(route, 200, ['CSV', 'FEC']))
  await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, 200, { format: route.request().postDataJSON().format, selection }))
})

async function openValidation(page: Page) {
  await page.goto('/exports/new?startDate=2026-08-01&endDate=2026-08-31')
  await page.getByRole('checkbox', { name: 'Select eligible invoices on this page' }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Validate accounting data' })).toBeFocused()
}

async function openFormats(page: Page, format?: ExportFormat) {
  await openValidation(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose export format' })).toBeFocused()
  if (format) await page.getByRole('radio', { name: format, exact: true }).check()
}

test('export review waits for format validation, posts the exact lot and never generates a file', async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  const posts: string[] = []
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname) })
  await mockApiRoute(page, `${root}/preflight`, async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().postDataJSON()).toEqual({ invoiceIds: [41, 42], startDate: '2026-08-01', endDate: '2026-08-31', format: 'CSV' })
    await pending
    await fulfillJson(route, 200, { format: 'CSV', selection })
  })
  await openFormats(page)
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await page.getByRole('radio', { name: 'CSV', exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Checking format…' })).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'FEC', exact: true })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toHaveCount(0)
  release()
  await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toBeFocused()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByLabel('Selection totals')).toContainText('120.00 EUR')
  await expect(page.getByLabel('Selection totals')).toContainText('240.00 USD')
  await expect(page.getByLabel('Selection totals')).not.toContainText('360.00')
  await page.locator('summary').click()
  await expect(page.getByLabel('Confirmed invoices')).toContainText('INV-041')
  await expect(page.getByLabel('Confirmed invoices')).toContainText('INV-042')
  await expect(page.getByRole('button', { name: 'Generate export' })).toBeDisabled()
  expect(posts).toEqual(['/api/v1/accounting-exports/selection/confirm', '/api/v1/accounting-exports/preflight'])
})

test('export review rechecks after changing the format and supports radio keyboard navigation', async ({ page }) => {
  const sent: string[] = []
  await mockApiRoute(page, `${root}/preflight`, async (route) => {
    sent.push(route.request().postDataJSON().format)
    await fulfillJson(route, 200, { format: sent.at(-1), selection })
  })
  await openFormats(page, 'FEC')
  await page.getByRole('radio', { name: 'FEC', exact: true }).focus()
  await page.keyboard.down('ArrowDown')
  await expect(page.getByRole('radio', { name: 'CSV', exact: true })).toBeChecked()
  await page.keyboard.up('ArrowDown')
  await expect(page.getByRole('radio', { name: 'FEC', exact: true })).not.toBeChecked()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('heading', { name: 'Confirm export generation' }).waitFor()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'CSV', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'FEC', exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('passed the FEC controls')
  expect(sent).toEqual(['CSV', 'FEC'])
})

test('export review keeps every blocking invoice and control visible and can switch to another format', async ({ page }) => {
  await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, 409, report))
  await openFormats(page, 'FEC')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toBeFocused()
  const errors = page.getByLabel('Accounting control errors')
  await expect(errors.getByRole('link', { name: 'INV-041' })).toHaveAttribute('href', '/invoices/41')
  await expect(errors.getByRole('link', { name: 'INV-042' })).toHaveAttribute('href', '/invoices/42')
  await expect(errors).toContainText('fec text invalid')
  await expect(errors).toContainText('The organization must have a valid SIRET')
  await expect(errors).toContainText('Account 607000 is inactive')
  await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByText('Passed — Invoice eligibility')).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('Account 607000 is inactive')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: '/tmp/kan293-control-errors.png', fullPage: true })
  await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, 200, { format: 'CSV', selection }))
  await page.getByRole('radio', { name: 'CSV', exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toBeVisible()
})

test('export review also reports detailed failures from the initial selection checks', async ({ page }) => {
  await mockApiRoute(page, `${root}/selection/confirm`, (route) => fulfillJson(route, 409, report))
  await page.goto('/exports/new')
  await page.getByRole('checkbox', { name: 'Select eligible invoices on this page' }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByLabel('Accounting control errors')).toContainText('Account 607000 is inactive')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
})

test('export review rejects stale selections and clears them when editing', async ({ page }) => {
  await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, 409, { code: report.code, invoices: [{ invoiceId: null, invoiceNumber: null, errors: [{ code: 'SELECTION_CHANGED', message: 'One or more selected invoices are no longer available in this period' }] }] }))
  await openFormats(page, 'CSV')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your selection has changed')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Accounting control errors').getByRole('link')).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit selection' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-041' })).not.toBeChecked()
})

test('export review never invents available formats while the capability request is pending', async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, `${root}/formats`, async (route) => { await pending; await fulfillJson(route, 200, ['CSV', 'UNKNOWN']) })
  await openFormats(page)
  await expect(page.getByRole('status', { name: 'Loading export formats' })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await page.screenshot({ path: '/tmp/kan293-format-loading.png', fullPage: true })
  release()
  await expect(page.getByRole('radio', { name: 'CSV', exact: true })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(1)
})

test('export review blocks empty format capabilities and does not offer a made-up template', async ({ page }) => {
  await mockApiRoute(page, `${root}/formats`, (route) => fulfillJson(route, 200, []))
  await openFormats(page)
  await expect(page.getByRole('status')).toContainText('No supported export formats are available')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await page.screenshot({ path: '/tmp/kan293-formats-empty.png', fullPage: true })
})

for (const status of [403, 404, 500]) {
  test(`export review handles formats API ${status}`, async ({ page }) => {
    await mockApiRoute(page, `${root}/formats`, (route) => fulfillJson(route, status, {}))
    await openFormats(page)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
    if (status === 500) {
      await mockApiRoute(page, `${root}/formats`, (route) => fulfillJson(route, 200, ['FEC']))
      await page.getByRole('button', { name: 'Try again' }).click()
      await expect(page.getByRole('radio', { name: 'FEC', exact: true })).toBeVisible()
    }
    if (status === 403) await page.screenshot({ path: '/tmp/kan293-format-permission.png', fullPage: true })
  })
}

for (const status of [400, 403, 404, 405, 500, 501]) {
  test(`export review handles preflight ${status} without optimistic confirmation`, async ({ page }) => {
    await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, status, {}))
    await openFormats(page, 'CSV')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Export validation failed')
    await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toHaveCount(0)
    if (status !== 500) await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
    else {
      await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, 200, { format: 'CSV', selection }))
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toBeVisible()
    }
  })
}

for (const endpoint of ['formats', 'preflight']) {
  test(`export review expires the session on ${endpoint} 401`, async ({ page }) => {
    if (endpoint === 'preflight') await openFormats(page, 'CSV')
    await mockApiRoute(page, `${root}/${endpoint}`, (route) => fulfillJson(route, 401, {}))
    if (endpoint === 'formats') {
      await page.goto('/exports/new')
      await page.getByRole('checkbox', { name: 'Select eligible invoices on this page' }).check()
    }
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
  })
}

test('export review ignores late validation after leaving and URL parameters cannot skip checks', async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, `${root}/preflight`, async (route) => { await pending; await fulfillJson(route, 200, { format: 'CSV', selection }) })
  await openFormats(page, 'CSV')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Checking format…' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to exports' }).click()
  release()
  await expect(page).toHaveURL('/exports')
  await page.goto('/exports/new?step=4&format=FEC&invoiceIds=41')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
})

test('export review refuses an inconsistent server receipt and recovers after a network error', async ({ page }) => {
  await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, 200, { format: 'FEC', selection }))
  await openFormats(page, 'CSV')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The export could not be checked')
  await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toHaveCount(0)
  await mockApiRoute(page, `${root}/preflight`, (route) => route.abort('failed'))
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The export could not be checked')
  await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, 200, { format: 'CSV', selection }))
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toBeVisible()
})

for (const width of [1440, 768, 390]) {
  test(`export review matches the three stages at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1024 })
    await openValidation(page)
    for (const stage of ['validation', 'format', 'confirmation']) {
      if (stage === 'format') {
        await page.getByRole('button', { name: 'Continue', exact: true }).click()
        await page.getByRole('radio', { name: 'CSV', exact: true }).check()
      }
      if (stage === 'confirmation') {
        await page.getByRole('button', { name: 'Continue', exact: true }).click()
        await page.getByRole('heading', { name: 'Confirm export generation' }).waitFor()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath(`${stage}-${width}.png`), fullPage: true })
    }
  })
}
