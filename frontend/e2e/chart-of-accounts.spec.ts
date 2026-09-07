import { expect, test } from '@playwright/test'

import type { ChartOfAccount } from '../src/types/onboarding'
import { AUTH_TOKEN_STORAGE_KEY, currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const accounts: ChartOfAccount[] = [
  { accountId: 1, accountNumber: '401000', accountLabel: 'Suppliers', accountType: 'PASSIF', active: true },
  { accountId: 2, accountNumber: '445660', accountLabel: 'Deductible VAT', accountType: 'ACTIF', active: true },
  { accountId: 3, accountNumber: '606300', accountLabel: 'Supplies', accountType: 'CHARGE', active: true },
  { accountId: 4, accountNumber: '626000', accountLabel: 'Telecom', accountType: 'CHARGE', active: true },
  { accountId: 5, accountNumber: '707000', accountLabel: 'Sales', accountType: 'PRODUIT', active: true },
  { accountId: 6, accountNumber: '411000', accountLabel: 'Customers', accountType: 'ACTIF', active: true },
  { accountId: 7, accountNumber: '512000', accountLabel: 'Bank', accountType: 'ACTIF', active: true },
  { accountId: 8, accountNumber: '625100', accountLabel: 'Travel', accountType: 'CHARGE', active: false },
  ...Array.from({ length: 34 }, (_, index) => ({ accountId: index + 9, accountNumber: String(800001 + index), accountLabel: `Project expense ${index + 1}`, accountType: 'CHARGE', active: true })),
]

function accountPage(content = accounts, number = 0, totalElements = content.length) {
  return { content, number, size: 100, totalElements, totalPages: Math.ceil(totalElements / 100) }
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, 200, accountPage()))
  await mockApiRoute(page, '/v1/accounting-entries?*', (route) => fulfillJson(route, 200, { content: [], number: 0, size: 8, totalElements: 0, totalPages: 0 }))
})

test('chart of accounts waits for every authenticated API page before global search and sorting', async ({ page }) => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...accounts[0], accountId: index + 1, accountNumber: String(400001 + index), accountLabel: `Zulu ${index}` }))
  const last = { ...accounts[7], accountId: 101, accountNumber: '999999', accountLabel: 'Alpha achats à crédit' }
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const requests: string[] = []
  await mockApiRoute(page, '/v1/chart-of-accounts?*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.method()).toBe('GET')
    expect(request.headers().authorization).toBe('Bearer e2e-token')
    expect(request.postData()).toBeNull()
    expect([...url.searchParams.keys()]).toEqual(['page', 'size'])
    requests.push(url.searchParams.toString())
    const number = Number(url.searchParams.get('page'))
    if (number === 1) await gate
    await fulfillJson(route, 200, accountPage(number === 0 ? firstPage : [last], number, 101))
  })
  await page.goto('/accounting/accounts?organizationId=999')
  await expect.poll(() => requests.length).toBe(2)
  await expect(page.getByRole('status', { name: 'Loading chart of accounts' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  release()
  await expect(page.getByRole('navigation', { name: 'Account pagination' })).toContainText('1–8 of 101 accounts')
  await page.getByRole('button', { name: 'Sort by label', exact: true }).click()
  await expect(page.locator('tbody tr').first()).toContainText(last.accountLabel)
  await page.getByRole('searchbox', { name: 'Search account number or label' }).fill('CREDIT')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('999999')
  await page.getByRole('searchbox').fill('999999')
  await expect(page.locator('tbody')).toContainText('Inactive')
  expect(requests).toEqual(['page=0&size=100', 'page=1&size=100'])
})

test('chart of accounts preserves pagination and filters through browser navigation and reload', async ({ page }) => {
  await page.goto('/accounting/accounts')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('navigation', { name: 'Account pagination' })).toContainText('9–16 of 42 accounts')
  await page.getByRole('combobox', { name: 'Account type' }).click()
  await page.getByRole('option', { name: 'CHARGE', exact: true }).click()
  await expect(page).not.toHaveURL(/page=/)
  await page.getByRole('combobox', { name: 'Account status' }).click()
  await page.getByRole('option', { name: 'Inactive', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('Travel')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Account status' })).toContainText('Inactive')
  await expect(page.getByRole('combobox', { name: 'Account type' })).toContainText('CHARGE')
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Account pagination' })).toContainText('1–8 of 42 accounts')
  await page.goBack()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('Travel')
  await page.getByRole('searchbox').fill('nothing matches')
  await expect(page.getByText('No matching accounts', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await page.getByRole('combobox', { name: 'Account status' }).click()
  await page.getByRole('option', { name: 'Active', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Account pagination' })).toContainText('of 41 accounts')
  await expect(page.locator('tbody').getByText('Inactive', { exact: true })).toHaveCount(0)
})

test('chart of accounts sorts each real column using the keyboard and handles URL bounds', async ({ page }) => {
  await page.goto('/accounting/accounts?page=999&sort=unsupported&direction=invalid&type=unknown&status=unknown')
  await expect(page.getByRole('navigation', { name: 'Account pagination' })).toContainText('41–42 of 42 accounts')
  const numberSort = page.getByRole('button', { name: 'Sort by account number', exact: true })
  await numberSort.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('columnheader', { name: 'Sort by account number' })).toHaveAttribute('aria-sort', 'descending')
  await expect(page.locator('tbody tr').first()).toContainText('800034')
  await expect(page).not.toHaveURL(/page=/)
  await page.reload()
  await expect(page.locator('tbody tr').first()).toContainText('800034')
  await page.getByRole('button', { name: 'Sort by label', exact: true }).click()
  await expect(page.locator('tbody tr').first()).toContainText('Bank')
  await page.getByRole('button', { name: 'Sort by type', exact: true }).click()
  await expect(page.locator('tbody tr').first()).toContainText('ACTIF')
  await page.getByRole('button', { name: 'Sort by status', exact: true }).click()
  await expect(page.locator('tbody tr').first()).toContainText('Active')
  await page.getByRole('button', { name: 'Sort by status', exact: true }).click()
  await expect(page.locator('tbody tr').first()).toContainText('Inactive')
  await page.goto('/accounting/accounts?page=-2')
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('chart of accounts discards partial data on failure and retries the whole plan', async ({ page }, testInfo) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let failed = false
  const requests: number[] = []
  await mockApiRoute(page, '/v1/chart-of-accounts?*', async (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'))
    requests.push(number)
    if (failed) return fulfillJson(route, 200, accountPage([]))
    if (number === 0) return fulfillJson(route, 200, accountPage(accounts, 0, 101))
    await gate
    failed = true
    await fulfillJson(route, 503, {})
  })
  await page.goto('/accounting/accounts')
  await expect.poll(() => requests.length).toBe(2)
  await expect(page.getByRole('status', { name: 'Loading chart of accounts' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('accounts-loading.png'), fullPage: true })
  release()
  await expect(page.getByText('Unable to load chart of accounts', { exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('accounts-error.png'), fullPage: true })
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('No accounts yet', { exact: true })).toBeVisible()
  expect(requests).toEqual([0, 1, 0])
  await page.screenshot({ path: testInfo.outputPath('accounts-empty.png'), fullPage: true })
})

for (const status of [403, 404, 405, 501]) {
  test(`chart of accounts handles ${status} without showing data or an empty plan`, async ({ page }, testInfo) => {
    await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, status, {}))
    await page.goto('/accounting/accounts')
    await expect(page.getByText(status === 403 ? 'Chart of accounts access denied' : 'Chart of accounts unavailable', { exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByText('No accounts yet', { exact: true })).toHaveCount(0)
    if (status === 403) await page.screenshot({ path: testInfo.outputPath('accounts-forbidden.png'), fullPage: true })
  })
}

test('chart of accounts handles network loss and expired sessions', async ({ page }) => {
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => route.abort())
  await page.goto('/accounting/accounts')
  await expect(page.getByText('Unable to load chart of accounts', { exact: true })).toBeVisible()
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, 401, {}))
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
})

test('chart of accounts clears the previous organization across sign out and sign in', async ({ page }) => {
  await page.goto('/accounting/accounts')
  await expect(page.locator('tbody')).toContainText('Suppliers')
  await page.getByRole('button', { name: 'Sign out' }).click()
  const otherUser = { ...currentUser, id: 2, role: { id: 2, code: 'OPERATEUR_COMPTABLE', label: 'Accountant' }, organization: { id: 2, name: 'Beta', legalName: 'Beta SAS' } }
  await mockCurrentUser(page, otherUser)
  await mockApiRoute(page, '/v1/auth/login', (route) => fulfillJson(route, 200, { token: 'other-org-token' }))
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, '/v1/chart-of-accounts?*', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer other-org-token')
    await gate
    await fulfillJson(route, 200, accountPage([{ ...accounts[0], accountLabel: 'Beta suppliers' }]))
  })
  await page.getByLabel('Work email').fill('beta@example.com')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('link', { name: 'Accounting', exact: true }).click()
  await page.getByRole('tab', { name: 'Chart of accounts', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Loading chart of accounts' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  release()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('Beta suppliers')
  await expect(page.locator('tbody').getByText('Suppliers', { exact: true })).toHaveCount(0)
})

test('chart of accounts ignores responses from a previous visit after navigation', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let oldResponseSent!: () => void
  const oldResponse = new Promise<void>((resolve) => { oldResponseSent = resolve })
  let requests = 0
  await mockApiRoute(page, '/v1/chart-of-accounts?*', async (route) => {
    const old = ++requests === 1
    if (old) await gate
    await fulfillJson(route, 200, accountPage(old ? accounts : [{ ...accounts[0], accountLabel: 'Updated account' }]))
    if (old) oldResponseSent()
  })
  await page.goto('/accounting/accounts')
  await expect.poll(() => requests).toBe(1)
  await page.getByRole('tab', { name: 'Entries', exact: true }).click()
  await expect(page.getByText('No accounting entries yet', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Chart of accounts', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('Updated account')
  release()
  await oldResponse
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('Updated account')
})

for (const [role, width] of [['ADMIN', 1440], ['ADMIN', 768], ['ADMIN', 390], ['OPERATEUR_COMPTABLE', 390], ['RESPONSABLE_COMPTABLE', 1440]] as const) {
  test(`chart of accounts is readable for ${role} at ${width}px`, async ({ page }, testInfo) => {
    await mockCurrentUser(page, { ...currentUser, role: { id: 1, code: role, label: role } })
    await page.setViewportSize({ width, height: 1024 })
    await page.goto('/accounting')
    await page.getByRole('tab', { name: 'Entries', exact: true }).focus()
    await page.keyboard.press('End')
    await expect(page).toHaveURL(/\/accounting\/accounts$/)
    await expect(page.getByRole('tab', { name: 'Chart of accounts', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('tbody tr')).toHaveCount(8)
    await expect(page.locator('tbody')).toContainText('Inactive')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 1440 && role === 'ADMIN') await expect(page.getByRole('button', { name: 'Add account', exact: true })).toBeDisabled()
    if (role !== 'ADMIN') await expect(page.getByRole('button', { name: 'Add account', exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`accounts-${role}-${width}.png`), fullPage: true })
    if (width === 390) {
      const tableRegion = page.getByRole('region', { name: 'Chart of accounts table', exact: true })
      await tableRegion.focus()
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => tableRegion.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    }
  })
}
