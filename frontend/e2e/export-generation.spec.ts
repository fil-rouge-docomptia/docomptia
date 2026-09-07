import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ExportFormat, ExportGenerationReceipt, ExportSelection } from '../src/types/export'
import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const root = '/v1/accounting-exports'
const selected: ExportSelection = {
  organizationId: 1, organizationName: 'Acme', startDate: '2026-08-01', endDate: '2026-08-31',
  invoices: [{ invoiceId: 41, invoiceNumber: 'INV-041', invoiceDate: '2026-08-15', supplierName: 'Acme Supplies', currencyCode: 'EUR', invoiceAmount: 120, eligible: true, totalDebit: 120, totalCredit: 120, errors: [] }],
  totals: [{ currencyCode: 'EUR', invoiceAmount: 120, totalDebit: 120, totalCredit: 120 }],
}
const candidates = { ...selected, invoices: [...selected.invoices, { ...selected.invoices[0], invoiceId: 42, invoiceNumber: 'INV-042' }] }
const receipt: ExportGenerationReceipt = { exportBatchId: 85, organizationId: 1, format: 'CSV', status: 'GENERE', fileName: 'accounting-export-2026-08-01_2026-08-31.csv', fileSize: 1320, generatedAt: '2026-09-08T10:48:00', createdByName: 'Alexandre Grodent', invoiceIds: [41] }
const report = { code: 'ACCOUNTING_EXPORT_VALIDATION_FAILED', invoices: [{ invoiceId: 41, invoiceNumber: 'INV-041', errors: [{ code: 'ACCOUNT_INACTIVE', message: 'Account 607000 is inactive' }, { code: 'ACCOUNTING_ENTRY_UNBALANCED', message: 'Debit and credit totals differ' }] }] }
const file = 'entryNumber,invoiceNumber\n1,INV-041\n'

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, `${root}?*`, (route) => fulfillJson(route, 200, { content: [], number: 0, size: 8, totalElements: 0, totalPages: 0 }))
  await mockApiRoute(page, `${root}/summary`, (route) => fulfillJson(route, 200, { readyToExport: 2, blockedInvoices: 0, exportedThisMonth: 0, monthStart: '2026-09-01', monthEnd: '2026-09-30' }))
  await mockApiRoute(page, `${root}/selection?*`, (route) => fulfillJson(route, 200, candidates))
  await mockApiRoute(page, `${root}/selection/confirm`, (route) => fulfillJson(route, 200, selected))
  await mockApiRoute(page, `${root}/formats`, (route) => fulfillJson(route, 200, ['CSV', 'FEC']))
  await mockApiRoute(page, `${root}/preflight`, (route) => fulfillJson(route, 200, { format: route.request().postDataJSON().format, selection: selected }))
  await mockApiRoute(page, `${root}/generate`, (route) => fulfillJson(route, 200, { ...receipt, format: route.request().postDataJSON().format }))
  await mockApiRoute(page, `${root}/85/file`, (route) => route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'access-control-allow-origin': '*' }, body: file }))
})

async function confirmation(page: Page, format: ExportFormat = 'CSV') {
  await page.goto('/exports/new?startDate=2026-08-01&endDate=2026-08-31')
  await page.getByRole('checkbox', { name: 'Select invoice INV-041', exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Validate accounting data' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('radio', { name: format, exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Confirm export generation' })).toBeVisible()
}

async function generated(page: Page) {
  await confirmation(page)
  await page.getByRole('button', { name: 'Generate export', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Export generated', exact: true })).toBeFocused()
}

for (const format of ['CSV', 'FEC'] as const) {
  test(`export generation waits for the ${format} receipt and prevents double submission`, async ({ page }) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => { release = resolve })
    const posts: string[] = []
    page.on('request', (request) => { if (request.method() === 'POST') posts.push(new URL(request.url()).pathname) })
    await mockApiRoute(page, `${root}/generate`, async (route) => {
      expect(route.request().method()).toBe('POST')
      expect(route.request().headers().authorization).toBe('Bearer e2e-token')
      expect(route.request().postDataJSON()).toEqual({ startDate: selected.startDate, endDate: selected.endDate, invoiceIds: [41], format })
      await pending
      await fulfillJson(route, 200, { ...receipt, format, fileName: format === 'FEC' ? '732829320FEC20260831.txt' : receipt.fileName })
    })
    await confirmation(page, format)
    await page.getByRole('button', { name: 'Generate export', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
    await expect(page.getByRole('heading', { name: 'Generating export…', exact: true })).toBeFocused()
    await expect(page.getByRole('progressbar', { name: 'Export generation progress' })).not.toHaveAttribute('aria-valuenow')
    await expect(page.getByRole('heading', { name: 'Export generated', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Generate export', exact: true })).toHaveCount(0)
    await expect(page.getByText('1 invoice exported', { exact: false })).toHaveCount(0)
    release()
    await expect(page.getByRole('heading', { name: 'Export generated', exact: true })).toBeFocused()
    await expect(page.getByRole('status')).toContainText(`1 invoice exported · ${format}`)
    await expect(page.getByLabel('Generated file')).toContainText(format === 'FEC' ? '732829320FEC20260831.txt' : receipt.fileName)
    await expect(page.getByRole('link', { name: 'View export', exact: true })).toHaveAttribute('href', '/exports?query=85#export-history')
    expect(posts).toEqual(['/api/v1/accounting-exports/selection/confirm', '/api/v1/accounting-exports/preflight', '/api/v1/accounting-exports/generate'])
  })
}

test('export generation downloads the authenticated stored bytes and refreshes an archived batch in history', async ({ page }) => {
  let generations = 0
  let downloads = 0
  await mockApiRoute(page, `${root}/generate`, async (route) => { generations++; await fulfillJson(route, 200, receipt) })
  await mockApiRoute(page, `${root}/85/file`, async (route) => {
    downloads++
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    await route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'access-control-allow-origin': '*' }, body: file })
  })
  await generated(page)
  for (let attempt = 0; attempt < 2; attempt++) {
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download export 85', exact: true }).click()
    const saved = await download
    expect(saved.suggestedFilename()).toBe(receipt.fileName)
    expect(await readFile((await saved.path())!, 'utf8')).toBe(file)
  }
  await mockApiRoute(page, `${root}?*`, async (route) => {
    expect(new URL(route.request().url()).searchParams.get('query')).toBe('85')
    await fulfillJson(route, 200, { content: [{ ...receipt, status: 'ARCHIVE', createdAt: receipt.generatedAt, periodStartDate: selected.startDate, periodEndDate: selected.endDate, invoiceCount: 1, amounts: [{ currencyCode: 'EUR', amount: 120 }], downloadable: true }], number: 0, size: 8, totalElements: 1, totalPages: 1 })
  })
  await page.getByRole('link', { name: 'View export', exact: true }).click()
  await expect(page).toHaveURL('/exports?query=85#export-history')
  await expect(page.getByRole('table', { name: 'Export history' })).toContainText('Archived')
  const historyDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download export 85' }).click()
  await historyDownload
  expect(generations).toBe(1)
  expect(downloads).toBe(3)
})

test('export generation waits for file bytes and ignores the download after creating another export', async ({ page }) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  let downloads = 0
  let savedFiles = 0
  page.on('download', () => { savedFiles++ })
  await mockApiRoute(page, `${root}/85/file`, async (route) => {
    downloads++
    await pending
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: file })
  })
  await generated(page)
  const button = page.getByRole('button', { name: 'Download export 85' })
  await button.evaluate((element: HTMLButtonElement) => { element.click(); element.click() })
  await expect(button).toBeDisabled()
  await expect(button).toHaveText('Downloading…')
  expect(savedFiles).toBe(0)
  await page.getByRole('button', { name: 'Create another export' }).click()
  release()
  await expect(page.getByRole('heading', { name: 'Select accounting entries' })).toBeVisible()
  expect(downloads).toBe(1)
  expect(savedFiles).toBe(0)
})

test('export generation clears the old result and selection when creating another export', async ({ page }) => {
  await generated(page)
  await page.getByRole('button', { name: 'Create another export' }).click()
  await expect(page.getByRole('heading', { name: 'Select accounting entries' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-041' })).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Download export 85' })).toHaveCount(0)
})

test('export generation reports every control and requires fresh selection before retry', async ({ page }) => {
  await mockApiRoute(page, `${root}/generate`, (route) => fulfillJson(route, 409, report))
  await confirmation(page)
  await page.getByRole('button', { name: 'Generate export', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Export generation failed' })).toBeFocused()
  await expect(page.getByLabel('Accounting control errors')).toContainText('Account 607000 is inactive')
  await expect(page.getByLabel('Accounting control errors')).toContainText('Debit and credit totals differ')
  await expect(page.getByRole('link', { name: 'INV-041' })).toHaveAttribute('href', '/invoices/41')
  await expect(page.getByRole('button', { name: 'Generate export', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit selection' }).click()
  await expect(page.getByRole('checkbox', { name: 'Select invoice INV-041' })).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
})

for (const status of [400, 403, 404, 405, 409, 501]) {
  test(`export generation handles rejection ${status} without showing success`, async ({ page }, testInfo) => {
    await mockApiRoute(page, `${root}/generate`, (route) => fulfillJson(route, status, {}))
    await confirmation(page)
    await page.getByRole('button', { name: 'Generate export', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Export generation failed' })).toBeFocused()
    await expect(page.getByText('No file was created by this request.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download export 85' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'View export history' })).toHaveAttribute('href', '/exports')
    if (status === 403) {
      await expect(page.getByRole('alert')).toContainText('You do not have permission')
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath('generation-permission.png'), fullPage: true })
    }
  })
}

for (const outcome of ['network', '500', 'wrong organization', 'wrong invoices', 'preparation', 'missing file'] as const) {
  test(`export generation reconciles ${outcome} with history without claiming rollback`, async ({ page }, testInfo) => {
    await mockApiRoute(page, `${root}/generate`, (route) => outcome === 'network' ? route.abort('failed')
      : fulfillJson(route, outcome === '500' ? 500 : 200, { ...receipt,
        ...(outcome === 'wrong organization' ? { organizationId: 2 } : {}),
        ...(outcome === 'wrong invoices' ? { invoiceIds: [42] } : {}),
        ...(outcome === 'preparation' ? { status: 'PREPARATION' } : {}),
        ...(outcome === 'missing file' ? { fileName: null } : {}),
      }))
    await confirmation(page)
    await page.getByRole('button', { name: 'Generate export', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Export result not confirmed' })).toBeFocused()
    await expect(page.getByRole('alert')).toContainText('The export may have completed')
    if (outcome === '500') {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath('generation-uncertain.png'), fullPage: true })
    }
    await expect(page.getByText('No file was created by this request.')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Generate export', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Download export 85' })).toHaveCount(0)
  })
}

for (const status of [403, 404, 500]) {
  test(`export generation keeps the generated result after download ${status} and can retry the download`, async ({ page }) => {
    let generations = 0
    await mockApiRoute(page, `${root}/generate`, async (route) => { generations++; await fulfillJson(route, 200, receipt) })
    await mockApiRoute(page, `${root}/85/file`, (route) => fulfillJson(route, status, {}))
    await generated(page)
    await page.getByRole('button', { name: 'Download export 85' }).click()
    await expect(page.getByRole('alert')).toContainText(status === 403 ? 'Download access denied' : status === 404 ? 'Export file not found' : 'Download failed')
    await expect(page.getByRole('heading', { name: 'Export generated', exact: true })).toBeVisible()
    await mockApiRoute(page, `${root}/85/file`, (route) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: file }))
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download export 85' }).click()
    await download
    expect(generations).toBe(1)
  })
}

for (const endpoint of ['generate', '85/file']) {
  test(`export generation closes an expired session on ${endpoint}`, async ({ page }) => {
    if (endpoint === 'generate') await confirmation(page); else await generated(page)
    await mockApiRoute(page, `${root}/${endpoint}`, (route) => fulfillJson(route, 401, {}))
    await page.getByRole('button', { name: endpoint === 'generate' ? 'Generate export' : 'Download export 85', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
  })
}

test('export generation ignores a late receipt after leaving and cannot be restored through URL parameters', async ({ page }) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, `${root}/generate`, async (route) => { await pending; await fulfillJson(route, 200, receipt) })
  await confirmation(page)
  await page.getByRole('button', { name: 'Generate export', exact: true }).click()
  await expect(page.getByText('Leaving this page does not cancel generation.', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'Back to exports', exact: true }).click()
  release()
  await expect(page).toHaveURL('/exports')
  await page.goto('/exports/new?status=success&exportBatchId=85&step=4')
  await expect(page.getByRole('heading', { name: 'Select accounting entries' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download export 85' })).toHaveCount(0)
})

for (const code of ['ADMIN', 'OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`export generation works for the existing ${code} role`, async ({ page }) => {
    await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code } })
    await generated(page)
    await expect(page.getByRole('button', { name: 'Download export 85' })).toBeEnabled()
  })
}

for (const width of [1440, 768, 390]) {
  test(`export generation renders Generating Success and Failed at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1024 })
    let release = () => {}
    const pending = new Promise<void>((resolve) => { release = resolve })
    await mockApiRoute(page, `${root}/generate`, async (route) => { await pending; await fulfillJson(route, 200, receipt) })
    await confirmation(page)
    await page.getByRole('button', { name: 'Generate export', exact: true }).focus()
    await page.keyboard.press('Enter')
    for (const stage of ['Generating', 'Success', 'Failed']) {
      if (stage === 'Success') release()
      if (stage === 'Failed') {
        await mockApiRoute(page, `${root}/generate`, (route) => fulfillJson(route, 409, report))
        await confirmation(page)
        await page.getByRole('button', { name: 'Generate export', exact: true }).click()
      }
      await expect(page.getByRole('heading', { name: stage === 'Generating' ? 'Generating export…' : stage === 'Success' ? 'Export generated' : 'Export generation failed', exact: true })).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: testInfo.outputPath(`${stage}-${width}.png`), fullPage: true })
    }
  })
}
