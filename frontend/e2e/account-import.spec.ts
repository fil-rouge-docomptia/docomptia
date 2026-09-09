import { readFile } from 'node:fs/promises'
import { expect, test, type Page, type Request as PlaywrightRequest } from '@playwright/test'

import type { AccountImportInspection, AccountImportPreview, AccountImportResult } from '../src/types/account-import'
import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const base = '/v1/chart-of-accounts/import'
const csv = 'number,label,type,active\n001ABC,Office supplies,CHARGE,0\n401000,Suppliers,PASSIF,1\n001ABC,Duplicate,CHARGE,1\n,Missing number,CHARGE,1\n'
const upload = { name: 'accounts.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }
const inspection: AccountImportInspection = { fileName: upload.name, fileSize: upload.buffer.length, delimiter: ',', columns: ['number', 'label', 'type', 'active'], totalRows: 4, sampleRows: [['001ABC', 'Office supplies', 'CHARGE', '0']] }
const preview: AccountImportPreview = {
  fingerprint: 'preview-from-server', totalRows: 4, newAccounts: 1, existingAccounts: 1, duplicateAccounts: 1, invalidRows: 1,
  rows: [
    { lineNumber: 2, accountNumber: '001ABC', accountLabel: 'Office supplies', accountType: 'CHARGE', active: false, status: 'NEW', errors: [] },
    { lineNumber: 3, accountNumber: '401000', accountLabel: 'Suppliers', accountType: 'PASSIF', active: true, status: 'EXISTING', errors: [] },
    { lineNumber: 4, accountNumber: '001ABC', accountLabel: 'Duplicate', accountType: 'CHARGE', active: true, status: 'DUPLICATE', errors: [] },
    { lineNumber: 5, accountNumber: '', accountLabel: 'Missing number', accountType: 'CHARGE', active: true, status: 'INVALID', errors: ['Account number is required'] },
  ],
}
const result: AccountImportResult = { imported: 1, existingAccounts: 1, duplicateAccounts: 1, invalidRows: 1, importedByUserId: 1, importedAt: '2026-09-07T18:00:00', rows: preview.rows.map((row) => ({ ...row, status: row.status === 'NEW' ? 'IMPORTED' : row.status })) }

async function finishImport(page: Page) {
  await openConfirmation(page)
  await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
}

async function next(page: Page) { await page.getByRole('button', { name: 'Continue', exact: true }).click() }

async function chooseMapping(page: Page, withActive = true) {
  for (const [column, field] of [['number', 'Account number (required)'], ['label', 'Account label (required)'], ['type', 'Account type (required)'], ...(withActive ? [['active', 'Active status (optional)']] : [])]) {
    await page.getByRole('combobox', { name: column, exact: true }).click()
    await page.getByRole('option', { name: field, exact: true }).click()
  }
}

async function openMapping(page: Page) {
  await page.goto('/accounting/accounts/import')
  await page.getByLabel('CSV file', { exact: true }).setInputFiles(upload)
  await next(page)
  await expect(page.getByRole('heading', { name: 'Map CSV columns' })).toBeVisible()
}

async function openReview(page: Page) {
  await openMapping(page)
  await chooseMapping(page)
  await next(page)
  await expect(page.getByRole('heading', { name: 'Review detected accounts' })).toBeVisible()
}

async function openConfirmation(page: Page) {
  await openReview(page)
  await page.getByRole('checkbox', { name: 'Exclude 1 invalid rows from this import' }).check()
  await next(page)
  await expect(page.getByRole('heading', { name: 'Confirm account import' })).toBeVisible()
}

async function multipart(request: PlaywrightRequest) {
  expect(request.method()).toBe('POST')
  expect(request.headers().authorization).toBe('Bearer e2e-token')
  expect(request.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/)
  return new Response(request.postDataBuffer(), { headers: { 'Content-Type': request.headers()['content-type'] } }).formData()
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 })
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, 200, { content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 }))
  await mockApiRoute(page, `${base}/inspect`, (route) => fulfillJson(route, 200, inspection))
  await mockApiRoute(page, `${base}/preview`, (route) => fulfillJson(route, 200, preview))
  await mockApiRoute(page, `${base}/confirm`, (route) => fulfillJson(route, 200, result))
})

test('account import inspects, previews and confirms exact multipart data only on explicit actions', async ({ page }, testInfo) => {
  const requests: string[] = []
  const releases = new Map<string, () => void>()
  for (const stage of ['inspect', 'preview', 'confirm']) {
    const gate = new Promise<void>((resolve) => { releases.set(stage, resolve) })
    await mockApiRoute(page, `${base}/${stage}`, async (route) => {
      requests.push(stage)
      const body = await multipart(route.request())
      expect([...body.keys()].sort()).toEqual((stage === 'inspect' ? ['file', 'delimiter'] : stage === 'preview' ? ['file', 'delimiter', 'mapping'] : ['file', 'delimiter', 'mapping', 'fingerprint', 'excludeInvalidRows']).sort())
      const file = body.get('file') as File
      expect(file.name).toBe(upload.name)
      expect(await file.text()).toBe(csv)
      expect(body.get('delimiter')).toBe(',')
      if (stage !== 'inspect') {
        const mapping = body.get('mapping') as File
        expect(mapping.type).toBe('application/json')
        expect(JSON.parse(await mapping.text())).toEqual({ accountNumber: 0, accountLabel: 1, accountType: 2, active: 3 })
      }
      if (stage === 'confirm') { expect(body.get('fingerprint')).toBe(preview.fingerprint); expect(body.get('excludeInvalidRows')).toBe('true') }
      await gate
      await fulfillJson(route, 200, stage === 'inspect' ? inspection : stage === 'preview' ? preview : result)
    })
  }
  await page.goto('/accounting/accounts')
  await page.getByRole('link', { name: 'Import CSV' }).click()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Browse CSV' }).focus()
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles(upload)
  expect(requests).toEqual([])
  await next(page)
  await expect(page.getByRole('status')).toHaveText('Inspecting CSV…')
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('import-inspecting.png'), fullPage: true, animations: 'disabled' })
  releases.get('inspect')!()
  await expect(page.getByRole('heading', { name: 'Map CSV columns' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Import chart of accounts', level: 2 })).toBeFocused()
  await chooseMapping(page)
  await next(page)
  await expect(page.getByRole('status')).toHaveText('Preparing preview…')
  await expect(page.getByRole('combobox', { name: 'number', exact: true })).toBeDisabled()
  releases.get('preview')!()
  await expect(page.getByRole('table')).toContainText('001ABC')
  await expect(page.getByRole('table')).toContainText('Account number is required')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  expect(requests).toEqual(['inspect', 'preview'])
  await page.getByRole('checkbox').focus()
  await page.keyboard.press('Space')
  await next(page)
  expect(requests).toEqual(['inspect', 'preview'])
  await page.getByRole('button', { name: 'Import accounts', exact: true }).dblclick()
  await expect(page.getByRole('status')).toHaveText('Importing accounts…')
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
  await expect(page.getByText('1 accounts imported', { exact: true })).toHaveCount(0)
  expect(requests).toEqual(['inspect', 'preview', 'confirm'])
  await page.screenshot({ path: testInfo.outputPath('import-confirming.png'), fullPage: true, animations: 'disabled' })
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, 200, { content: [{ accountId: 10, ...preview.rows[0] }], totalElements: 1, totalPages: 1, number: 0, size: 100 }))
  releases.get('confirm')!()
  await expect(page.getByRole('heading', { name: 'Import completed with issues' })).toBeVisible()
  await expect(page).toHaveURL(/\/accounting\/accounts\/import$/)
  await page.getByRole('link', { name: 'View accounts', exact: true }).click()
  await expect(page).toHaveURL(/\/accounting\/accounts$/)
  await expect(page.getByRole('table')).toContainText('Office supplies')
  await expect(page.getByRole('table')).toContainText('Inactive')
  await page.screenshot({ path: testInfo.outputPath('import-confirmed.png'), fullPage: true, animations: 'disabled' })
})

for (const invalid of [
  { name: 'accounts.xlsx', mimeType: 'text/csv', size: 10, message: 'Choose a CSV file (.csv).' },
  { name: 'accounts.csv', mimeType: 'application/pdf', size: 10, message: 'This file type is not supported.' },
  { name: 'empty.csv', mimeType: 'text/csv', size: 0, message: 'The CSV file is empty.' },
  { name: 'large.csv', mimeType: 'text/csv', size: 20 * 1024 * 1024 + 1, message: 'no larger than 20 MB' },
]) {
  test(`account import rejects ${invalid.name} ${invalid.mimeType} locally before any upload`, async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => { if (request.url().includes('/import/')) requests.push(request.url()) })
    await page.goto('/accounting/accounts/import?step=4&confirm=1&organizationId=999')
    await expect(page.getByText('Step 1 of 4 · Upload')).toBeVisible()
    await page.getByLabel('CSV file', { exact: true }).setInputFiles({ name: invalid.name, mimeType: invalid.mimeType, buffer: Buffer.alloc(invalid.size, 'x') })
    await expect(page.getByRole('alert')).toContainText(invalid.message)
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
    expect(requests).toEqual([])
  })
}

test('account import supports drop, rejects multiple files and resets inspection on separator or file changes', async ({ page }) => {
  await page.goto('/accounting/accounts/import')
  const drop = async (count: number) => {
    const data = await page.evaluateHandle(({ csv, count }) => {
      const transfer = new DataTransfer()
      for (let index = 0; index < count; index += 1) transfer.items.add(new File([csv], `accounts-${index}.csv`, { type: 'text/csv' }))
      return transfer
    }, { csv, count })
    await page.getByText('Drop your chart of accounts here').dispatchEvent('drop', { dataTransfer: data })
    await data.dispose()
  }
  await drop(2)
  await expect(page.getByRole('alert')).toContainText('one CSV file')
  await drop(1)
  await expect(page.getByText('accounts-0.csv', { exact: true })).toBeVisible()
  await next(page)
  await chooseMapping(page)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByText('4 detected rows', { exact: false })).toBeVisible()
  await page.getByRole('combobox', { name: 'Column separator' }).click()
  await page.getByRole('option', { name: 'Semicolon (;)' }).click()
  await expect(page.getByText('Ready', { exact: true })).toHaveCount(0)
  await mockApiRoute(page, `${base}/inspect`, async (route) => { expect((await multipart(route.request())).get('delimiter')).toBe(';'); await fulfillJson(route, 200, { ...inspection, delimiter: ';' }) })
  await next(page)
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByText('accounts-0.csv', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
})

test('account import enforces a unique complete mapping and permits an unmapped active column', async ({ page }) => {
  await openMapping(page)
  await page.getByRole('combobox', { name: 'number', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('option', { name: 'Account number (required)', exact: true }).click()
  await page.getByRole('combobox', { name: 'label', exact: true }).click()
  await expect(page.getByRole('option', { name: 'Account number (required)', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  await chooseMapping(page, false)
  await mockApiRoute(page, `${base}/preview`, async (route) => {
    const mapping = (await multipart(route.request())).get('mapping') as File
    expect(JSON.parse(await mapping.text())).toEqual({ accountNumber: 0, accountLabel: 1, accountType: 2, active: null })
    await fulfillJson(route, 200, { ...preview, invalidRows: 0 })
  })
  await next(page)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()
})

test('account import requires a new preview and invalid-row choice after changing the mapping', async ({ page }) => {
  let previews = 0
  await mockApiRoute(page, `${base}/preview`, async (route) => { previews += 1; await fulfillJson(route, 200, { ...preview, fingerprint: `preview-${previews}` }) })
  await openConfirmation(page)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('combobox', { name: 'active', exact: true }).click()
  await page.getByRole('option', { name: 'Ignore column', exact: true }).click()
  await next(page)
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
  expect(previews).toBe(2)
  await page.getByRole('checkbox').check()
  await next(page)
  await mockApiRoute(page, `${base}/confirm`, async (route) => { expect((await multipart(route.request())).get('fingerprint')).toBe('preview-2'); await fulfillJson(route, 200, result) })
  await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import completed with issues' })).toBeVisible()
})

for (const stage of ['inspect', 'preview'] as const) {
  for (const status of [400, 403, 404, 413, 500]) {
    test(`account import retains the file or mapping after ${stage} ${status}`, async ({ page }, testInfo) => {
      await mockApiRoute(page, `${base}/${stage}`, (route) => fulfillJson(route, status, { message: 'The CSV is not valid UTF-8.' }))
      if (stage === 'inspect') { await page.goto('/accounting/accounts/import'); await page.getByLabel('CSV file', { exact: true }).setInputFiles(upload) }
      else { await openMapping(page); await chooseMapping(page) }
      await next(page)
      await expect(page.getByRole('alert')).toBeVisible()
      if (stage === 'inspect') await expect(page.getByText(upload.name, { exact: true })).toBeVisible()
      else await expect(page.getByRole('combobox', { name: 'number', exact: true })).toContainText('Account number')
      if (status === 403 || status === 404) await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
      else await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Import accounts', exact: true })).toHaveCount(0)
      if (status === 400 || status === 403) await page.screenshot({ path: testInfo.outputPath(`import-${stage}-${status}.png`), fullPage: true, animations: 'disabled' })
    })
  }
}

for (const status of [400, 403, 404, 409, 413, 500, 'network'] as const) {
  test(`account import discards uncertain confirmation after ${status} and never silently replays it`, async ({ page }, testInfo) => {
    let confirms = 0
    await mockApiRoute(page, `${base}/confirm`, async (route) => { confirms += 1; if (status === 'network') await route.abort(); else await fulfillJson(route, status, { message: 'The import cannot be confirmed.', code: status === 409 ? 'ACCOUNT_IMPORT_PREVIEW_CHANGED' : status === 400 ? 'ACCOUNT_IMPORT_INVALID' : undefined }) })
    await openConfirmation(page)
    await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('heading', { name: status === 500 || status === 'network' ? 'Import not confirmed' : 'Import failed', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download report' })).toHaveCount(0)
    if (status === 409 || status === 'network') await page.screenshot({ path: testInfo.outputPath(`import-failure-${status}.png`), fullPage: true, animations: 'disabled' })
    if (status === 403 || status === 404) await expect(page.getByRole('button', { name: 'Retry import', exact: true })).toBeDisabled()
    else {
      await page.getByRole('button', { name: 'Retry import', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Map CSV columns' })).toBeVisible()
      await expect(page.getByRole('combobox', { name: 'number', exact: true })).toContainText('Account number')
      await mockApiRoute(page, `${base}/preview`, (route) => fulfillJson(route, 200, { ...preview, newAccounts: 0, existingAccounts: 2, fingerprint: 'updated' }))
      await next(page)
      await expect(page.getByRole('status')).toContainText('No new accounts to import')
      await page.getByRole('checkbox').check()
      await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
    }
    expect(confirms).toBe(1)
    if (status === 409 || status === 'network') await page.screenshot({ path: testInfo.outputPath(`import-recovery-${status}.png`), fullPage: true, animations: 'disabled' })
  })
}

test('account import paginates every mapped row and keeps exclusion explicit', async ({ page }) => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ ...preview.rows[0], lineNumber: index + 2, accountNumber: `00${index}` }))
  await mockApiRoute(page, `${base}/preview`, (route) => fulfillJson(route, 200, { ...preview, rows, totalRows: 25, newAccounts: 25, existingAccounts: 0, duplicateAccounts: 0, invalidRows: 0 }))
  await openReview(page)
  await expect(page.locator('tbody tr')).toHaveCount(10)
  await page.getByRole('button', { name: 'Page 3', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(5)
  await expect(page.getByRole('table')).toContainText('0024')
  await next(page)
  await mockApiRoute(page, `${base}/confirm`, async (route) => { expect((await multipart(route.request())).get('excludeInvalidRows')).toBe('false'); await fulfillJson(route, 200, { ...result, imported: 25, existingAccounts: 0, duplicateAccounts: 0, invalidRows: 0, rows: rows.map((row) => ({ ...row, status: 'IMPORTED' })) }) })
  await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
  await expect(page.getByText('25 accounts imported successfully', { exact: true })).toBeVisible()
})

test('account import cancels without writing and ignores a preview response after navigation', async ({ page }) => {
  let confirmations = 0
  await mockApiRoute(page, `${base}/confirm`, async (route) => { confirmations += 1; await fulfillJson(route, 200, result) })
  await openConfirmation(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(confirmations).toBe(0)
  await openMapping(page)
  await chooseMapping(page)
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, `${base}/preview`, async (route) => { await gate; await fulfillJson(route, 200, preview) })
  await next(page)
  await expect(page.getByRole('status')).toContainText('Preparing preview')
  await page.getByRole('tab', { name: 'Entries', exact: true }).click()
  release()
  await page.goto('/accounting/accounts/import')
  await expect(page.getByText('Step 1 of 4 · Upload')).toBeVisible()
  await expect(page.getByText(upload.name, { exact: true })).toHaveCount(0)
  expect(confirmations).toBe(0)
})

test('account import expires the session on 401', async ({ page }) => {
  await mockApiRoute(page, `${base}/inspect`, (route) => fulfillJson(route, 401, {}))
  await page.goto('/accounting/accounts/import')
  await page.getByLabel('CSV file', { exact: true }).setInputFiles(upload)
  await next(page)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('region', { name: 'Account import assistant' })).toHaveCount(0)
})

test('account import clears the previous organization file and report after signing in again', async ({ page }) => {
  await openConfirmation(page)
  await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import completed with issues' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await mockCurrentUser(page, { ...currentUser, id: 2, organization: { id: 2, name: 'Beta', legalName: 'Beta SAS' } })
  await mockApiRoute(page, '/v1/auth/login', (route) => fulfillJson(route, 200, { token: 'other-org-token' }))
  await mockApiRoute(page, '/v1/organizations/current/onboarding', (route) => fulfillJson(route, 200, { remainingActions: [] }))
  await page.getByLabel('Work email').fill('beta@example.com')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('link', { name: 'Accounting', exact: true }).click()
  await page.getByRole('tab', { name: 'Chart of accounts', exact: true }).click()
  await page.getByRole('link', { name: 'Import CSV', exact: true }).click()
  await expect(page.getByText('Step 1 of 4 · Upload')).toBeVisible()
  await expect(page.getByText(upload.name, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
})

for (const role of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`account import denies ${role} on direct navigation and hides the entry action`, async ({ page }, testInfo) => {
    const requests: string[] = []
    page.on('request', (request) => { if (request.url().includes('/import/')) requests.push(request.url()) })
    await mockCurrentUser(page, { ...currentUser, role: { id: 2, code: role, label: role } })
    await page.goto('/accounting/accounts/import?step=4')
    await expect(page.getByRole('alert')).toContainText('Account import access denied')
    await expect(page.getByRole('button', { name: 'Browse CSV' })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`import-denied-${role}.png`), fullPage: true, animations: 'disabled' })
    await page.getByRole('link', { name: 'Back to chart of accounts' }).click()
    await expect(page.getByRole('link', { name: 'Import CSV' })).toHaveCount(0)
    expect(requests).toEqual([])
  })
}

for (const width of [1440, 768, 390]) {
  test(`account import four stages fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1024 })
    await page.goto('/accounting/accounts')
    await page.getByRole('link', { name: 'Import CSV' }).click()
    for (let step = 1; step <= 4; step += 1) {
      await expect(page.getByText(`Step ${step} of 4`, { exact: false })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const heading = await page.getByRole('heading', { name: 'Import chart of accounts', level: 2 }).boundingBox()
      expect(heading!.y).toBeGreaterThanOrEqual(64)
      if (step === 3 && width === 390) {
        const region = page.getByRole('region', { name: 'Mapped account rows', exact: true })
        await region.focus()
        await page.keyboard.press('ArrowRight')
        await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
        await region.evaluate((element) => { element.scrollTo({ left: 0, behavior: 'instant' }); window.scrollTo({ top: 0, behavior: 'instant' }) })
      }
      await page.screenshot({ path: testInfo.outputPath(`import-${step}-${width}.png`), fullPage: true, animations: 'disabled' })
      if (step === 1) await page.getByLabel('CSV file', { exact: true }).setInputFiles(upload)
      if (step === 2) await chooseMapping(page)
      if (step === 3) await page.getByRole('checkbox').check()
      if (step < 4) await next(page)
    }
  })
}

for (const imported of [0, 1]) {
  test(`account import reports ${imported} creations without treating existing accounts as a partial failure`, async ({ page }) => {
    const rows = result.rows.filter((row) => row.status !== 'INVALID').map((row) => ({ ...row, status: row.status === 'IMPORTED' && imported === 0 ? 'EXISTING' as const : row.status }))
    await mockApiRoute(page, `${base}/confirm`, (route) => fulfillJson(route, 200, { ...result, imported, invalidRows: 0, existingAccounts: 2 - imported, rows }))
    await finishImport(page)
    await expect(page.getByRole('heading', { name: imported ? 'Chart of accounts imported' : 'No new accounts imported', exact: true })).toBeVisible()
    await expect(page.getByText('Step 4 of 4 · Import complete', { exact: true })).toBeVisible()
    await expect(page.getByRole('status')).toContainText(`${2 - imported} existing accounts and 1 duplicate rows skipped.`)
    await expect(page.getByRole('heading', { name: 'Import completed with issues', exact: true })).toHaveCount(0)
    await expect(page.locator('time')).toHaveAttribute('datetime', result.importedAt)
    await page.getByRole('combobox', { name: 'Filter import results' }).click()
    await page.getByRole('option', { name: 'Rejected (0)', exact: true }).click()
    await expect(page.getByRole('table')).toContainText('No rows in this category.')
  })
}

test('account import downloads every actual result row safely regardless of pagination and filtering', async ({ page }) => {
  const importedRows = Array.from({ length: 24 }, (_, index) => ({ ...result.rows[0], lineNumber: index + 2, accountNumber: `00${index}`, accountLabel: index === 0 ? '=SUM(1,2)' : index === 1 ? 'Équipement, "bureau"\nParis' : index === 2 ? '\t@SUM(1)' : index === 3 ? ' +123' : `Account ${index}` }))
  const rows = [...importedRows, ...result.rows.slice(1).map((row, index) => ({ ...row, lineNumber: index + 26 }))]
  const report = { ...result, imported: 24, rows }
  await mockApiRoute(page, `${base}/confirm`, (route) => fulfillJson(route, 200, report))
  await finishImport(page)
  await expect(page.getByRole('status')).toContainText('24 imported · 2 skipped · 1 rejected')
  await expect(page.locator('tbody tr')).toHaveCount(10)
  await page.getByRole('button', { name: 'Page 3', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('Account number is required')
  await page.getByRole('combobox', { name: 'Filter import results' }).click()
  await page.getByRole('option', { name: 'Rejected (1)', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr')).toContainText('28')
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download report', exact: true }).focus()
  await page.keyboard.press('Enter')
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('accounts-import-report.csv')
  const text = await readFile((await download.path())!, 'utf8')
  expect(text.startsWith('\uFEFF"Line","Account number"')).toBe(true)
  expect(text).toContain('"2","000","\'=SUM(1,2)"')
  expect(text).toContain('"Équipement, ""bureau""\nParis"')
  expect(text).toContain('"\'\t@SUM(1)"')
  expect(text).toContain('"\' +123"')
  expect(text).toContain('"25","0023","Account 23","CHARGE","false","Imported"')
  expect(text).toContain('"26","401000","Suppliers","PASSIF","true","Skipped (existing)"')
  expect(text).toContain('"27","001ABC","Duplicate","CHARGE","true","Skipped (duplicate)"')
  expect(text).toContain('"28","","Missing number","CHARGE","true","Rejected","Account number is required","2026-09-07T18:00:00","1"')
  await page.getByRole('button', { name: 'Import corrected CSV' }).click()
  await expect(page.getByText('Step 1 of 4 · Upload', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download report' })).toHaveCount(0)
  await expect(page.getByText(upload.name, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
})

test('account import recovers after a lost confirmation by previewing existing accounts before a new explicit import', async ({ page }) => {
  let confirmations = 0
  let previews = 0
  await mockApiRoute(page, `${base}/preview`, async (route) => {
    previews += 1
    await fulfillJson(route, 200, previews === 1 ? preview : { ...preview, fingerprint: 'fresh-after-lost-response', existingAccounts: 2, invalidRows: 0, rows: [{ ...preview.rows[0], status: 'EXISTING' }, { ...preview.rows[0], lineNumber: 6, accountNumber: '002NEW' }] })
  })
  await mockApiRoute(page, `${base}/confirm`, async (route) => {
    confirmations += 1
    if (confirmations === 1) { await route.abort(); return }
    const body = await multipart(route.request())
    expect(body.get('fingerprint')).toBe('fresh-after-lost-response')
    expect(body.get('excludeInvalidRows')).toBe('false')
    await fulfillJson(route, 200, { ...result, invalidRows: 0, existingAccounts: 2, rows: [{ ...result.rows[0], status: 'EXISTING' }, { ...result.rows[0], lineNumber: 6, accountNumber: '002NEW' }] })
  })
  await finishImport(page)
  await expect(page.getByRole('heading', { name: 'Import not confirmed', exact: true })).toBeVisible()
  await expect(page.getByText('No accounts were added', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry import', exact: true }).click()
  expect(confirmations).toBe(1)
  expect(previews).toBe(1)
  await next(page)
  await expect(page.getByRole('table')).toContainText('Existing')
  await expect(page.getByRole('table')).toContainText('002NEW')
  await next(page)
  expect(confirmations).toBe(1)
  await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chart of accounts imported', exact: true })).toBeVisible()
  expect(confirmations).toBe(2)
  expect(previews).toBe(2)
})

test('account import treats an unreadable successful response as uncertain and keeps the report private to the visit', async ({ page }) => {
  await mockApiRoute(page, `${base}/confirm`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'invalid json', headers: { 'Access-Control-Allow-Origin': '*' } }))
  await finishImport(page)
  await expect(page.getByRole('heading', { name: 'Import not confirmed', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download report' })).toHaveCount(0)
  await mockApiRoute(page, `${base}/confirm`, (route) => fulfillJson(route, 200, result))
  await page.getByRole('button', { name: 'Retry import', exact: true }).click()
  await next(page)
  await page.getByRole('checkbox').check()
  await next(page)
  await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Download report' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Step 1 of 4 · Upload', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download report' })).toHaveCount(0)
  await expect(page.getByText(upload.name, { exact: true })).toHaveCount(0)
})

test('account import ignores confirmation arriving after navigation', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, `${base}/confirm`, async (route) => { await gate; await fulfillJson(route, 200, result) })
  await finishImport(page)
  await expect(page.getByRole('heading', { name: 'Importing accounts…' })).toBeVisible()
  await page.getByRole('tab', { name: 'Entries', exact: true }).click()
  release()
  await page.getByRole('tab', { name: 'Chart of accounts', exact: true }).click()
  await page.getByRole('link', { name: 'Import CSV' }).click()
  await expect(page.getByText('Step 1 of 4 · Upload', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download report' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Import completed with issues' })).toHaveCount(0)
})

for (const width of [1440, 768, 390]) {
  for (const state of ['pending', 'success', 'partial', 'failed'] as const) {
    test(`account import ${state} result fits ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1024 })
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      await mockApiRoute(page, `${base}/confirm`, async (route) => {
        if (state === 'pending') await gate
        await fulfillJson(route, state === 'failed' ? 409 : 200, state === 'failed' ? { code: 'ACCOUNT_IMPORT_PREVIEW_CHANGED', message: 'The preview has changed. Review the accounts again before confirming.' } : state === 'success' ? { ...result, invalidRows: 0, rows: result.rows.filter((row) => row.status !== 'INVALID') } : result)
      })
      await finishImport(page)
      await expect(page.getByRole('heading', { name: state === 'pending' ? 'Importing accounts…' : state === 'success' ? 'Chart of accounts imported' : state === 'partial' ? 'Import completed with issues' : 'Import failed', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (state === 'pending') {
        await expect(page.getByRole('progressbar', { name: 'Waiting for import confirmation' })).not.toHaveAttribute('aria-valuenow')
        await expect(page.getByRole('progressbar', { name: 'Waiting for import confirmation' }).locator('div')).toHaveCSS('transform', 'none')
        await expect(page.getByRole('button', { name: 'Import accounts', exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Download report' })).toHaveCount(0)
      }
      if (state === 'partial' && width === 390) {
        const region = page.getByRole('region', { name: 'Import report rows' })
        await region.focus()
        await page.keyboard.press('ArrowRight')
        await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
        await region.evaluate((element) => { element.scrollTo({ left: 0, behavior: 'instant' }); window.scrollTo({ top: 0, behavior: 'instant' }) })
      }
      await page.screenshot({ path: testInfo.outputPath(`import-result-${state}-${width}.png`), fullPage: true, animations: 'disabled' })
      release()
    })
  }
}
