import { expect, test, type Page } from '@playwright/test'

import type { ChartOfAccount } from '../src/types/onboarding'
import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const active: ChartOfAccount = { accountId: 1, accountNumber: '401000', accountLabel: 'Suppliers', accountType: 'PASSIF', active: true }
const inactive: ChartOfAccount = { accountId: 2, accountNumber: '625100', accountLabel: 'Old travel expenses', accountType: 'CHARGE', active: false }
const plan = (content = [active, inactive]) => ({ content, number: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 })

async function openAction(page: Page, action: 'Edit account' | 'Deactivate account', accountNumber = active.accountNumber) {
  await page.getByRole('button', { name: `Actions for account ${accountNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
  return page.getByRole('dialog')
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/chart-of-accounts?*', (route) => fulfillJson(route, 200, plan()))
})

test('account management waits for the plan and creates an active account only after confirmation', async ({ page }, testInfo) => {
  let releasePlan!: () => void
  const planGate = new Promise<void>((resolve) => { releasePlan = resolve })
  await mockApiRoute(page, '/v1/chart-of-accounts?*', async (route) => { await planGate; await fulfillJson(route, 200, plan([])) })
  let releaseSave!: () => void
  const saveGate = new Promise<void>((resolve) => { releaseSave = resolve })
  const saved = { ...active, accountId: 10, accountNumber: '001ABC', accountLabel: 'Server confirmed label', accountType: 'CUSTOM' }
  let writes = 0
  await mockApiRoute(page, '/v1/chart-of-accounts', async (route) => {
    writes += 1
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().headers()['content-type']).toBe('application/json')
    expect(route.request().postDataJSON()).toEqual({ accountNumber: '001ABC', accountLabel: 'New account', accountType: 'CUSTOM' })
    await saveGate
    await fulfillJson(route, 201, saved)
  })
  await page.goto('/accounting/accounts?query=missing&type=PASSIF&status=inactive')
  await expect(page.getByRole('button', { name: 'Add account', exact: true })).toBeDisabled()
  releasePlan()
  await page.getByRole('button', { name: 'Add account', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add account', exact: true })
  await expect(dialog.getByLabel('Account number')).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Add account', exact: true })).toBeDisabled()
  await dialog.getByLabel('Account number').fill(' 001ABC ')
  await dialog.getByLabel('Label', { exact: false }).fill(' New account ')
  await dialog.getByLabel('Type', { exact: false }).fill(' CUSTOM ')
  await dialog.getByRole('button', { name: 'Add account', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(page.getByText('Account created', { exact: true })).toHaveCount(0)
  expect(writes).toBe(1)
  await page.screenshot({ path: testInfo.outputPath('account-saving.png'), fullPage: true })
  releaseSave()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Account created', { exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toContainText(saved.accountLabel)
  await expect(page.getByRole('table')).toContainText('Active')
  await expect(page).toHaveURL(/query=001ABC$/)
  await expect(page.getByRole('button', { name: 'Add account', exact: true })).toBeFocused()
  expect(writes).toBe(1)
  await page.screenshot({ path: testInfo.outputPath('account-created.png'), fullPage: true })
})

test('account management edits only changed fields and keeps the current view', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let writes = 0
  await mockApiRoute(page, '/v1/chart-of-accounts/1', async (route) => {
    writes += 1
    expect(route.request().method()).toBe('PATCH')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().postDataJSON()).toEqual({ accountLabel: 'Updated suppliers' })
    await gate
    await fulfillJson(route, 200, { ...active, accountLabel: 'Updated suppliers' })
  })
  await page.goto('/accounting/accounts?query=401&status=active')
  const dialog = await openAction(page, 'Edit account')
  await expect(dialog.getByLabel('Account number')).toHaveValue('401000')
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await dialog.getByLabel('Label', { exact: false }).fill('   ')
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await dialog.getByLabel('Label', { exact: false }).fill(' Updated suppliers ')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('tbody')).not.toContainText('Updated suppliers')
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  release()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('table')).toContainText('Updated suppliers')
  await expect(page).toHaveURL(/query=401&status=active$/)
  expect(writes).toBe(1)
})

for (const mode of ['create', 'edit'] as const) {
  for (const status of [400, 403, 404, 409, 500]) {
    test(`account management preserves ${mode} inputs after ${status}`, async ({ page }, testInfo) => {
      const path = mode === 'create' ? '/v1/chart-of-accounts' : '/v1/chart-of-accounts/1'
      await mockApiRoute(page, path, (route) => fulfillJson(route, status, { code: status === 409 ? 'CHART_OF_ACCOUNT_CONFLICT' : 'ERROR' }))
      await page.goto('/accounting/accounts')
      if (mode === 'create') await page.getByRole('button', { name: 'Add account', exact: true }).click()
      else await openAction(page, 'Edit account')
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Account number').fill('401001')
      await dialog.getByLabel('Label', { exact: false }).fill('Draft label')
      await dialog.getByLabel('Type', { exact: false }).fill('FREE_TYPE')
      const save = dialog.getByRole('button', { name: mode === 'create' ? 'Add account' : 'Save changes', exact: true })
      await save.click()
      await expect(dialog.getByRole('alert')).toBeVisible()
      await expect(dialog.getByLabel('Label', { exact: false })).toHaveValue('Draft label')
      await expect(dialog.getByLabel('Type', { exact: false })).toHaveValue('FREE_TYPE')
      await expect(page.locator('tbody')).not.toContainText('Draft label')
      if (status === 403 || status === 404) await expect(save).toBeDisabled()
      else await expect(save).toBeEnabled()
      if (status === 409) {
        await expect(dialog.getByRole('alert')).toContainText('already used in your organization')
        await expect(dialog.getByLabel('Account number')).toHaveAttribute('aria-invalid', 'true')
        await expect(dialog.getByLabel('Account number')).toBeFocused()
        await mockApiRoute(page, path, (route) => fulfillJson(route, mode === 'create' ? 201 : 200, { ...active, accountNumber: '401002', accountLabel: 'Draft label', accountType: 'FREE_TYPE' }))
        await page.screenshot({ path: testInfo.outputPath(`account-${mode}-conflict.png`), fullPage: true })
        await dialog.getByLabel('Account number').fill('401002')
        await save.click()
        await expect(dialog).toHaveCount(0)
        await expect(page.getByRole('table')).toContainText('401002')
      }
      if (status === 403) await page.screenshot({ path: testInfo.outputPath(`account-${mode}-forbidden.png`), fullPage: true })
    })
  }
}

test('account management confirms deactivation and keeps the same account after the response', async ({ page }, testInfo) => {
  const writes: string[] = []
  page.on('request', (request) => { if (['POST', 'PATCH', 'DELETE'].includes(request.method())) writes.push(`${request.method()} ${new URL(request.url()).pathname}`) })
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, '/v1/chart-of-accounts/1/deactivate', async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().postData()).toBeNull()
    await gate
    await fulfillJson(route, 200, { ...active, active: false })
  })
  await page.goto('/accounting/accounts')
  let dialog = await openAction(page, 'Deactivate account')
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await expect(dialog).toContainText('Existing entries and rule references will be kept')
  expect(writes).toEqual([])
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Actions for account 401000', exact: true })).toBeFocused()
  expect(writes).toEqual([])
  dialog = await openAction(page, 'Deactivate account')
  await page.screenshot({ path: testInfo.outputPath('account-deactivation-confirmation.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Deactivate account', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Deactivating…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: '401000' })).toContainText('Active')
  release()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.locator('tbody tr').filter({ hasText: '401000' })).toContainText('Inactive')
  expect(writes).toEqual(['POST /api/v1/chart-of-accounts/1/deactivate'])
  await page.getByRole('button', { name: 'Actions for account 401000', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Deactivate account', exact: true })).toBeDisabled()
})

for (const status of [400, 403, 404, 500]) {
  test(`account management retains the active account after deactivation ${status}`, async ({ page }) => {
    await mockApiRoute(page, '/v1/chart-of-accounts/1/deactivate', (route) => fulfillJson(route, status, {}))
    await page.goto('/accounting/accounts')
    const dialog = await openAction(page, 'Deactivate account')
    await dialog.getByRole('button', { name: 'Deactivate account', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(page.locator('tbody tr').filter({ hasText: '401000' })).toContainText('Active')
    await expect(page.getByText('Account deactivated', { exact: true })).toHaveCount(0)
    if (status === 403 || status === 404) await expect(dialog.getByRole('button', { name: 'Deactivate account', exact: true })).toBeDisabled()
  })
}

test('account management edits inactive accounts without reactivation and discards cancelled changes', async ({ page }) => {
  await page.goto('/accounting/accounts')
  let dialog = await openAction(page, 'Edit account', inactive.accountNumber)
  await expect(dialog.getByText('Inactive', { exact: true })).toBeVisible()
  await dialog.getByLabel('Label', { exact: false }).fill('Cancelled change')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  dialog = await openAction(page, 'Edit account', inactive.accountNumber)
  await expect(dialog.getByLabel('Label', { exact: false })).toHaveValue(inactive.accountLabel)
  await mockApiRoute(page, '/v1/chart-of-accounts/2', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ accountLabel: 'Updated inactive account' })
    await fulfillJson(route, 200, { ...inactive, accountLabel: 'Updated inactive account' })
  })
  await dialog.getByLabel('Label', { exact: false }).fill('Updated inactive account')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('tbody tr').filter({ hasText: inactive.accountNumber })).toContainText('Inactive')
  await expect(page.locator('tbody tr').filter({ hasText: inactive.accountNumber })).toContainText('Updated inactive account')
})

test('account management keeps a draft after network loss and handles an expired session on retry', async ({ page }) => {
  await mockApiRoute(page, '/v1/chart-of-accounts/1', (route) => route.abort())
  await page.goto('/accounting/accounts')
  const dialog = await openAction(page, 'Edit account')
  await dialog.getByLabel('Label', { exact: false }).fill('Offline draft')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('has not been confirmed')
  await expect(dialog.getByLabel('Label', { exact: false })).toHaveValue('Offline draft')
  await mockApiRoute(page, '/v1/chart-of-accounts/1', (route) => fulfillJson(route, 401, {}))
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const role of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`account management stays unavailable to ${role}`, async ({ page }) => {
    await mockCurrentUser(page, { ...currentUser, role: { id: 2, code: role, label: role } })
    await page.goto('/accounting/accounts?create=1&edit=1&deactivate=1')
    await expect(page.getByRole('table')).toContainText('Suppliers')
    await expect(page.getByRole('button', { name: 'Add account', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Actions for account/ })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

for (const width of [1440, 768, 390]) {
  test(`account management forms and confirmation fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1024 })
    await page.goto('/accounting/accounts')
    await page.getByRole('button', { name: 'Add account', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Account number').fill('606300')
    await dialog.getByLabel('Label', { exact: false }).fill('Office supplies')
    await dialog.getByLabel('Type', { exact: false }).fill('CHARGE')
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`account-add-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    dialog = await openAction(page, 'Edit account')
    await expect(dialog.getByLabel('Account number')).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath(`account-edit-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    dialog = await openAction(page, 'Deactivate account')
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`account-confirm-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
