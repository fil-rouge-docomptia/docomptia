import { expect, test } from '@playwright/test'

import type { AccountingRule, ChartOfAccount } from '../src/types/onboarding'
import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const expense: ChartOfAccount = { accountId: 1, accountNumber: '626000', accountLabel: 'Telecommunications', accountType: 'CHARGE', active: true }
const vat: ChartOfAccount = { accountId: 2, accountNumber: '445660', accountLabel: 'Deductible VAT', accountType: 'ACTIF', active: true }
const supplier: ChartOfAccount = { accountId: 3, accountNumber: '401000', accountLabel: 'Suppliers', accountType: 'PASSIF', active: true }
const alternative: ChartOfAccount = { accountId: 104, accountNumber: '607000', accountLabel: 'Building supplies', accountType: 'CHARGE', active: true }
const inactive: ChartOfAccount = { accountId: 5, accountNumber: '608000', accountLabel: 'Old purchases', accountType: 'CHARGE', active: false }
const accounts = [expense, vat, supplier, alternative, inactive]
const firstRule: AccountingRule = { accountingRuleId: 11, ruleName: 'Orange Business', priority: 10, expenseAccount: expense, vatAccount: vat, supplierAccount: supplier, active: true, configurationComplete: true }
const secondRule: AccountingRule = { ...firstRule, accountingRuleId: 12, ruleName: 'General purchases', priority: 100, active: false, expenseAccount: inactive, configurationComplete: false }
const rules = [firstRule, secondRule]
const accountPage = { content: accounts, number: 0, size: 100, totalElements: accounts.length, totalPages: 1 }

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/accounting-rules', (route) => fulfillJson(route, 200, rules))
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, 200, accountPage))
})

test('rules show real status, priority, assignments and selected rule in the URL', async ({ page }) => {
  await page.goto('/accounting/rules')
  await expect(page.getByRole('tab', { name: 'Rules', exact: true })).toHaveAttribute('aria-selected', 'true')
  const list = page.getByRole('region', { name: 'Accounting rules', exact: true })
  await expect(list.getByText('1 active', { exact: true })).toBeVisible()
  await expect(list.getByText('Priority 10', { exact: true })).toBeVisible()
  await expect(list.getByText('Priority 100', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit rule General purchases' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/rule=12/)
  await expect(page.locator('#rule-editor-title')).toBeFocused()
  await expect(page.getByRole('region', { name: 'General purchases', exact: true }).getByText('Account configuration needs attention')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toContainText('(inactive)')
  await page.goBack()
  await expect(page.locator('#rule-editor-title')).toHaveText('Orange Business')
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
})

test('rules wait for all account pages and save only changed fields after backend confirmation', async ({ page }) => {
  const pages: string[] = []
  let releaseAccounts!: () => void
  const accountsGate = new Promise<void>((resolve) => { releaseAccounts = resolve })
  await mockApiRoute(page, '/v1/chart-of-accounts?*', async (route) => {
    const url = new URL(route.request().url())
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().method()).toBe('GET')
    pages.push(url.searchParams.toString())
    const number = Number(url.searchParams.get('page'))
    if (number === 1) await accountsGate
    await fulfillJson(route, 200, { ...accountPage, content: number === 0 ? [expense, vat, supplier, inactive] : [alternative], number, totalPages: 2 })
  })
  let releaseSave!: () => void
  const saveGate = new Promise<void>((resolve) => { releaseSave = resolve })
  let patches = 0
  await mockApiRoute(page, '/v1/accounting-rules/11', async (route) => {
    patches += 1
    expect(route.request().method()).toBe('PATCH')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().postDataJSON()).toEqual({ expenseAccountId: 104 })
    await saveGate
    await fulfillJson(route, 200, { ...firstRule, expenseAccount: alternative })
  })
  await page.goto('/accounting/rules')
  await expect(page.getByRole('status', { name: 'Loading account options' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toBeDisabled()
  releaseAccounts()
  await page.getByRole('combobox', { name: 'Expense account', exact: true }).click()
  await expect(page.getByRole('option', { name: /Old purchases/ })).toHaveCount(0)
  await page.getByPlaceholder('Search account number or name…').fill('607000')
  await page.getByRole('option', { name: /Building supplies/ }).click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(page.getByText('Accounting rule updated', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Accounting rules', exact: true })).toContainText('Telecommunications')
  expect(patches).toBe(1)
  expect(pages).toEqual(['page=0&size=100', 'page=1&size=100'])
  releaseSave()
  await expect(page.getByText('Accounting rule updated', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Accounting rules', exact: true })).toContainText('Building supplies')
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  expect(patches).toBe(1)
})

test('rules search and status filters survive reload and never edit a different missing rule', async ({ page }) => {
  await page.goto('/accounting/rules?rule=999')
  await expect(page.getByText('Accounting rule not found', { exact: true })).toBeVisible()
  await expect(page.getByRole('form', { name: 'Edit accounting rule' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search rules' }).fill('purchases')
  await page.getByRole('combobox', { name: 'Rule status' }).click()
  await page.getByRole('option', { name: 'Inactive', exact: true }).click()
  await page.reload()
  await expect(page.locator('#rule-editor-title')).toHaveText('General purchases')
  await expect(page.getByRole('searchbox', { name: 'Search rules' })).toHaveValue('purchases')
  await page.getByRole('searchbox', { name: 'Search rules' }).fill('no match')
  await expect(page.getByText('No matching rules', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('#rule-editor-title')).toHaveText('Orange Business')
  await expect(page).toHaveURL(/\/accounting\/rules$/)
})

test('rules handle delayed loading, list failure, retry and empty state', async ({ page }, testInfo) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let failed = false
  await mockApiRoute(page, '/v1/accounting-rules', async (route) => {
    if (!failed) { await gate; failed = true; await fulfillJson(route, 503, {}) }
    else await fulfillJson(route, 200, [])
  })
  await page.goto('/accounting/rules')
  await expect(page.getByRole('status', { name: 'Loading accounting rules' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('rules-loading.png'), fullPage: true })
  release()
  await expect(page.getByText('Unable to load accounting rules', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('rules-error.png'), fullPage: true })
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('No accounting rules yet', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('rules-empty.png'), fullPage: true })
})

for (const status of [403, 404]) {
  test(`rules handle list ${status} without showing editable data`, async ({ page }) => {
    await mockApiRoute(page, '/v1/accounting-rules', (route) => fulfillJson(route, status, {}))
    await page.goto('/accounting/rules')
    await expect(page.getByText(status === 403 ? 'Accounting rules access denied' : 'Accounting rules unavailable', { exact: true })).toBeVisible()
    await expect(page.getByRole('form', { name: 'Edit accounting rule' })).toHaveCount(0)
  })
}

test('rules preserve current assignments when accounts fail and retry the complete plan', async ({ page }) => {
  let failed = true
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, failed ? 503 : 200, failed ? {} : accountPage))
  await page.goto('/accounting/rules')
  await expect(page.getByText('Account options unavailable', { exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toContainText('626000')
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  failed = false
  await page.getByRole('button', { name: 'Retry accounts' }).click()
  await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toBeEnabled()
})

test('rules do not invent a priority or an account when configuration is missing', async ({ page }) => {
  await mockApiRoute(page, '/v1/accounting-rules', (route) => fulfillJson(route, 200, [{ ...firstRule, priority: undefined, expenseAccount: null, configurationComplete: false }]))
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, 200, { ...accountPage, content: [inactive] }))
  await page.goto('/accounting/rules')
  await expect(page.getByText('No active accounts available', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Orange Business', exact: true })).toContainText('Priority unavailable')
  await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toHaveText('Not configured')
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
})

for (const status of [400, 403, 404, 500]) {
  test(`rules retain the draft and previous values after save ${status}`, async ({ page }, testInfo) => {
    await mockApiRoute(page, '/v1/accounting-rules/11', (route) => fulfillJson(route, status, {}))
    await page.goto('/accounting/rules')
    await page.getByRole('combobox', { name: 'Expense account', exact: true }).click()
    await page.getByRole('option', { name: /Building supplies/ }).click()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText(status === 403 ? 'Editing access denied' : status === 404 ? 'Rule no longer available' : 'Unable to save this rule', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Accounting rules', exact: true })).toContainText('Telecommunications')
    await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toContainText('Building supplies')
    await expect(page.getByText('Accounting rule updated', { exact: true })).toHaveCount(0)
    if (status === 403 || status === 404) await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
    if (status === 403) await page.screenshot({ path: testInfo.outputPath('rules-save-forbidden.png'), fullPage: true })
  })
}

test('rules respect expired sessions and reset unsaved changes without a request', async ({ page }) => {
  let patches = 0
  await mockApiRoute(page, '/v1/accounting-rules/11', async (route) => { patches += 1; await fulfillJson(route, 401, {}) })
  await page.goto('/accounting/rules')
  await page.getByRole('combobox', { name: 'Expense account', exact: true }).click()
  await page.getByRole('option', { name: /Building supplies/ }).click()
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toContainText('Telecommunications')
  expect(patches).toBe(0)
  await page.getByRole('combobox', { name: 'VAT account', exact: true }).click()
  await page.getByRole('option', { name: /Building supplies/ }).click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
})

for (const [role, width] of [['ADMIN', 1440], ['ADMIN', 768], ['ADMIN', 390], ['OPERATEUR_COMPTABLE', 390], ['RESPONSABLE_COMPTABLE', 1440]] as const) {
  test(`rules are responsive and respect ${role} access at ${width}px`, async ({ page }, testInfo) => {
    await mockCurrentUser(page, { ...currentUser, role: { id: 1, code: role, label: role } })
    await page.setViewportSize({ width, height: 1024 })
    await page.goto('/accounting/rules')
    await expect(page.locator('#rule-editor-title')).toHaveText('Orange Business')
    if (role === 'ADMIN') {
      await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Create rule', exact: true })).toBeDisabled()
    } else {
      await expect(page.getByText('Read-only access', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0)
      await expect(page.getByRole('combobox', { name: 'Expense account', exact: true })).toHaveCount(0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`rules-${role}-${width}.png`), fullPage: true })
  })
}

test('rules are reachable from Entries and preserve existing accounting navigation', async ({ page }) => {
  await mockApiRoute(page, '/v1/accounting-entries?*', (route) => fulfillJson(route, 200, { content: [], number: 0, size: 8, totalElements: 0, totalPages: 0 }))
  await page.goto('/accounting')
  await page.getByRole('tab', { name: 'Rules', exact: true }).click()
  await expect(page).toHaveURL(/\/accounting\/rules$/)
  await expect(page.locator('#rule-editor-title')).toHaveText('Orange Business')
  await page.getByRole('tab', { name: 'Entries', exact: true }).click()
  await expect(page.getByText('No accounting entries yet', { exact: true })).toBeVisible()
})
