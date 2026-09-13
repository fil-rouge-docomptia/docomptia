import { expect, test } from '@playwright/test'

import type { AccountingEntryRecord } from '../src/types/accounting'
import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const original: AccountingEntryRecord = {
  journal: { accountingJournalId: 1, code: 'ACH', label: 'Purchases', active: true },
  exportStatus: 'NOT_EXPORTED', exportBatchId: null, exportedAt: null, exportEligible: true, needsAttention: false, diagnostics: [],
  invoiceId: 31, invoiceNumber: 'INV-2026-0912', supplierName: 'Bouygues Construction',
  currencyCode: 'EUR', invoiceStatus: 'EXPORTABLE',
  entry: {
    version: 0, accountingEntryId: 51, entryNumber: 'ACC-2026-0912', entryDate: '2026-09-01',
    label: 'Building supplies', status: 'GENERATED', reversedAccountingEntryId: null,
    totalDebit: '12480.00', totalCredit: '12480.00', balanceDifference: '0.00', balanced: true,
    lines: [
      { accountingEntryLineId: 1, lineNumber: 1, accountNumber: '607000', accountLabel: 'Purchases', lineLabel: 'Supplies', debitAmount: '10400.00', creditAmount: '0.00' },
      { accountingEntryLineId: 2, lineNumber: 2, accountNumber: '445660', accountLabel: 'VAT', lineLabel: 'VAT', debitAmount: '2080.00', creditAmount: '0.00' },
      { accountingEntryLineId: 3, lineNumber: 3, accountNumber: '401000', accountLabel: 'Supplier', lineLabel: 'Supplier', debitAmount: '0.00', creditAmount: '12480.00' },
    ],
  },
}
const correction: AccountingEntryRecord = {
  ...original, supplierName: 'Leroy Construction', invoiceStatus: 'VALIDEE', exportEligible: false, needsAttention: true,
  entry: { ...original.entry, accountingEntryId: 52, entryNumber: 'COR-2026-0912', status: 'CORRECTIVE', totalDebit: '12479.99', balanceDifference: '0.01', balanced: false },
}
const reversal: AccountingEntryRecord = {
  ...original, invoiceStatus: 'EXPORTEE', exportEligible: false, needsAttention: true,
  entry: { ...original.entry, accountingEntryId: 53, entryNumber: 'REV-2026-0912', status: 'REVERSAL', reversedAccountingEntryId: 51,
    lines: original.entry.lines.map((line) => ({ ...line, debitAmount: line.creditAmount, creditAmount: line.debitAmount })) },
}
const entries = [original, correction, reversal]
const entryPage = { content: entries, number: 0, size: 8, totalElements: 3, totalPages: 1 }

test.beforeEach(async ({ page }) => {
  await mockApiRoute(page, '/v1/accounting-journals?*', (route) => fulfillJson(route, 200, { content: [original.journal], totalPages: 1 }))
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/accounting-entries?*', (route) => fulfillJson(route, 200, entryPage))
  await mockApiRoute(page, '/v1/accounting-entries/*', (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1))
    const entry = entries.find((record) => record.entry.accountingEntryId === id)
    return fulfillJson(route, entry ? 200 : 404, entry ?? {})
  })
})

test('accounting lists real totals and opens the exact reversal with keyboard focus restored', async ({ page }) => {
  await page.goto('/accounting')
  const table = page.getByRole('table', { name: 'Accounting entries', exact: true })
  await expect(table.getByText('€12,479.99')).toBeVisible()
  await expect(table.getByText('Needs attention', { exact: true })).toHaveCount(2)
  const open = table.getByRole('button', { name: 'Open entry REV-2026-0912' })
  await open.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/entry=53/)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'REV-2026-0912' })).toBeVisible()
  await expect(dialog.getByText('Reverses entry #51.')).toBeVisible()
  await expect(dialog.getByRole('table', { name: 'Entry lines' }).getByRole('row').nth(1)).toContainText('€10,400.00')
  await expect(dialog.getByLabel('Entry totals')).toContainText('€0.00')
  await expect(dialog.getByRole('link', { name: 'Open invoice INV-2026-0912' })).toHaveAttribute('href', '/invoices/31')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(open).toBeFocused()
})

test('accounting sends authenticated read-only requests and combined server filters', async ({ page }) => {
  const requests: URL[] = []
  await mockApiRoute(page, '/v1/accounting-entries?*', async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    const url = new URL(route.request().url())
    requests.push(url)
    expect(url.searchParams.has('organizationId')).toBe(false)
    expect(['8', '100']).toContain(url.searchParams.get('size'))
    await fulfillJson(route, 200, entryPage)
  })
  await page.goto('/accounting?organizationId=999&page=3')
  await page.getByRole('button', { name: 'Needs attention', exact: true }).click()
  await page.getByRole('combobox', { name: 'Entry type' }).click()
  await page.getByRole('option', { name: 'Corrective', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search entries' }).fill('  supplies  ')
  await page.getByRole('search', { name: 'Accounting search' }).getByRole('button', { name: 'Search', exact: true }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.get('query')).toBe('supplies')
  expect(Object.fromEntries(requests.at(-1)!.searchParams)).toEqual({ page: '0', size: '100', query: 'supplies', status: 'CORRECTIVE', sortBy: 'entryDate', direction: 'DESC' })
  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.toString()).toBe('page=0&size=8&sortBy=entryDate&direction=DESC')
  await expect(page.getByRole('button', { name: 'Export entries' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Create entry' })).toBeDisabled()
})

test('accounting paginates and ignores a late response after browser back', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, '/v1/accounting-entries?*', async (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'))
    if (number === 1) await pending
    await fulfillJson(route, 200, { ...entryPage, number, content: number === 0 ? [original] : [correction], totalElements: 16, totalPages: 2 })
  })
  await page.goto('/accounting')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('status', { name: 'Loading accounting entries' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open entry ACC-2026-0912' })).toHaveCount(0)
  await page.goBack()
  release()
  await expect(page.getByRole('button', { name: 'Open entry ACC-2026-0912' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open entry COR-2026-0912' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('button', { name: 'Open entry COR-2026-0912' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
})

test('accounting distinguishes empty, filtered and out-of-range pages', async ({ page }, testInfo) => {
  await mockApiRoute(page, '/v1/accounting-entries?*', (route) => fulfillJson(route, 200, { ...entryPage, content: [], totalElements: 0, totalPages: 0 }))
  await page.goto('/accounting?page=99')
  await expect(page.getByText('No entries on this page')).toBeVisible()
  await page.getByRole('button', { name: 'Back to first page' }).click()
  await expect(page.getByText('No accounting entries yet')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('accounting-empty.png'), fullPage: true })
  await page.getByRole('button', { name: 'Needs attention', exact: true }).click()
  await expect(page.getByText('No matching entries')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

for (const detail of [false, true]) {
  test(`accounting waits for the ${detail ? 'detail' : 'list'} response and retries failures`, async ({ page }, testInfo) => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    let failed = false
    await mockApiRoute(page, detail ? '/v1/accounting-entries/51' : '/v1/accounting-entries?*', async (route) => {
      if (!failed) { await pending; failed = true; await fulfillJson(route, 503, {}) }
      else await fulfillJson(route, 200, detail ? original : entryPage)
    })
    await page.goto(detail ? '/accounting?entry=51' : '/accounting')
    await expect(page.getByRole('status', { name: detail ? 'Loading accounting entry' : 'Loading accounting entries', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('accounting-loading.png'), fullPage: true })
    release()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('accounting-error.png'), fullPage: true })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(detail ? page.getByRole('dialog').getByText('Building supplies') : page.getByRole('table', { name: 'Accounting entries' })).toBeVisible()
  })
}

for (const status of [403, 404, 405, 501]) {
  test(`accounting displays ${status} without exposing stale entries`, async ({ page }, testInfo) => {
    await page.goto('/accounting')
    await expect(page.getByRole('table', { name: 'Accounting entries' })).toBeVisible()
    await mockApiRoute(page, '/v1/accounting-entries?*', (route) => fulfillJson(route, status, {}))
    await page.getByRole('button', { name: 'Balanced', exact: true }).click()
    await expect(page.getByText(status === 403 ? 'Accounting access denied' : 'Accounting entries unavailable', { exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    if (status === 403) await page.screenshot({ path: testInfo.outputPath('accounting-forbidden.png'), fullPage: true })
  })
}

test('accounting handles an expired session and foreign entry details', async ({ page }) => {
  await page.goto('/accounting?entry=999')
  await expect(page.getByRole('dialog').getByText('Accounting entry not found')).toBeVisible()
  await mockApiRoute(page, '/v1/accounting-entries?*', (route) => fulfillJson(route, 401, {}))
  await page.goto('/accounting')
  await expect(page).toHaveURL(/\/login$/)
})

test('accounting normalizes unsupported URL filters and rejects invalid identifiers', async ({ page }) => {
  const calls: string[] = []
  await mockApiRoute(page, '/v1/accounting-entries**', async (route) => {
    calls.push(new URL(route.request().url()).pathname)
    expect(new URL(route.request().url()).searchParams.toString()).toBe('page=0&size=8&sortBy=entryDate&direction=DESC')
    await fulfillJson(route, 200, entryPage)
  })
  for (const value of ['-1', '1.5', 'invalid', '9007199254740992']) {
    await page.goto(`/accounting?page=${value}&entry=${value}&balanced=invalid&status=unknown`)
    await expect(page.getByRole('dialog').getByText('Accounting entry not found')).toBeVisible()
  }
  expect(calls.every((path) => path.endsWith('/accounting-entries'))).toBe(true)
})

for (const [role, width] of [['ADMIN', 1440], ['OPERATEUR_COMPTABLE', 768], ['RESPONSABLE_COMPTABLE', 390]] as const) {
  test(`accounting stays readable for ${role} at ${width}px`, async ({ page }, testInfo) => {
    await mockCurrentUser(page, { ...currentUser, role: { id: 1, code: role, label: role } })
    await page.setViewportSize({ width, height: 1024 })
    await page.goto('/accounting')
    await expect(page.getByRole('table', { name: 'Accounting entries' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`accounting-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Open entry COR-2026-0912' }).click()
    await expect(page.getByRole('dialog').getByLabel('Entry totals')).toContainText('€0.01')
    expect(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`accounting-detail-${width}.png`), fullPage: true })
  })
}

test('KAN-398 filters confirmed diagnostics across every result page before pagination', async ({ page }) => {
  const pages: number[] = []
  const balancedWithIssue = { ...original, entry: { ...original.entry, accountingEntryId: 901, entryNumber: 'CHECK-901' }, needsAttention: true, exportEligible: false,
    diagnostics: [{ code: 'ACCOUNT_INACTIVE', message: 'The account is inactive', blocking: true, accountingEntryLineId: 1 }] }
  await mockApiRoute(page, '/v1/accounting-entries?*', async (route) => {
    const params = new URL(route.request().url()).searchParams
    expect(params.get('size')).toBe('100')
    expect(params.has('balanced')).toBe(false)
    const number = Number(params.get('page'))
    pages.push(number)
    await fulfillJson(route, 200, { number, size: 100, totalElements: 101, totalPages: 2,
      content: number === 0 ? Array.from({ length: 100 }, (_, i) => ({ ...original, entry: { ...original.entry, accountingEntryId: i + 1, entryNumber: `READY-${i}` } })) : [balancedWithIssue] })
  })
  await mockApiRoute(page, '/v1/accounting-entries/901', (route) => fulfillJson(route, 200, balancedWithIssue))
  await page.goto('/accounting?view=attention')
  await expect(page.getByRole('button', { name: 'Open entry CHECK-901' })).toBeVisible()
  expect(pages).toEqual([0, 1])
  await expect(page.getByRole('table', { name: 'Accounting entries' }).getByRole('row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Review issue' }).click()
  await expect(page.getByRole('dialog')).toContainText('The account is inactive')
})

test('KAN-398 preserves dates journals export filters and sorting in URL', async ({ page }) => {
  const requests: URL[] = []
  await mockApiRoute(page, '/v1/accounting-entries?*', async (route) => {
    requests.push(new URL(route.request().url()))
    await fulfillJson(route, 200, entryPage)
  })
  await page.goto('/accounting')
  await page.getByLabel('From date').fill('2026-09-01')
  await page.getByLabel('To date').fill('2026-09-30')
  await page.getByRole('combobox', { name: 'Journal', exact: true }).click()
  await page.getByRole('option', { name: 'ACH — Purchases' }).click()
  await page.getByRole('combobox', { name: 'Export status', exact: true }).click()
  await page.getByRole('option', { name: 'Not exported', exact: true }).click()
  await page.getByRole('columnheader').getByRole('button', { name: 'Supplier', exact: true }).click()
  await expect.poll(() => Object.fromEntries(requests.at(-1)!.searchParams)).toMatchObject({ startDate: '2026-09-01', endDate: '2026-09-30', journalId: '1', exportStatus: 'NOT_EXPORTED', sortBy: 'supplierName', direction: 'ASC' })
  await page.reload()
  await expect(page.getByLabel('From date')).toHaveValue('2026-09-01')
  await page.getByRole('button', { name: 'Remove journalId: 1' }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.has('journalId')).toBe(false)
})

test('KAN-398 stores optional columns per organization and keeps entry actions', async ({ page }) => {
  await page.goto('/accounting')
  await page.getByRole('button', { name: 'Columns' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Debit', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('columnheader', { name: 'Debit', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('columnheader', { name: 'Debit', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Actions for ACC-2026-0912' })).toBeVisible()
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `/private/tmp/accounting-front-tools/kan398-${width}.png`, fullPage: true })
  }
  await mockCurrentUser(page, { ...currentUser, organization: { ...currentUser.organization, id: 2 } })
  await page.reload()
  await expect(page.getByRole('columnheader', { name: 'Debit', exact: true })).toBeVisible()
})
