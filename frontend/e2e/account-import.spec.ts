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
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled()
  await expect(page.getByText('1 accounts imported', { exact: true })).toHaveCount(0)
  expect(requests).toEqual(['inspect', 'preview', 'confirm'])
  await page.screenshot({ path: testInfo.outputPath('import-confirming.png'), fullPage: true, animations: 'disabled' })
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, 200, { content: [{ accountId: 10, ...preview.rows[0] }], totalElements: 1, totalPages: 1, number: 0, size: 100 }))
  releases.get('confirm')!()
  await expect(page).toHaveURL(/\/accounting\/accounts$/)
  await expect(page.getByText('1 accounts imported', { exact: true })).toBeVisible()
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
  await expect(page).toHaveURL(/\/accounting\/accounts$/)
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
    await mockApiRoute(page, `${base}/confirm`, async (route) => { confirms += 1; if (status === 'network') await route.abort(); else await fulfillJson(route, status, { message: 'The import cannot be confirmed.' }) })
    await openConfirmation(page)
    await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Map CSV columns' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'number', exact: true })).toContainText('Account number')
    await expect(page.getByText('1 accounts imported', { exact: true })).toHaveCount(0)
    if (status === 403 || status === 404) await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled()
    else {
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
  await mockApiRoute(page, `${base}/confirm`, async (route) => { expect((await multipart(route.request())).get('excludeInvalidRows')).toBe('false'); await fulfillJson(route, 200, { ...result, imported: 25, invalidRows: 0 }) })
  await page.getByRole('button', { name: 'Import accounts', exact: true }).click()
  await expect(page.getByText('25 accounts imported', { exact: true })).toBeVisible()
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

test('account import clears the previous organization file and preview after signing in again', async ({ page }) => {
  await openConfirmation(page)
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
