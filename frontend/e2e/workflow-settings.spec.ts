import { expect, test, type Page, type Route } from '@playwright/test'

import { AUTH_TOKEN_STORAGE_KEY, currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const endpoint = '/v1/organizations/current/validation-preferences'
const amountRule = { validationRequired: true, validationThreshold: 1000 }
const allRule = { validationRequired: true, validationThreshold: null }
const disabledRule = { validationRequired: false, validationThreshold: null }
const activeRule = (page: Page) => page.getByRole('article', { name: 'Active approval rule' })
const deferred = () => { let release = () => {}; const promise = new Promise<void>((resolve) => { release = resolve }); return { release, promise } }

async function mockPreferences(page: Page, preferences: unknown = amountRule, patch?: (route: Route) => Promise<void>) {
  await mockApiRoute(page, `${endpoint}*`, async (route) => {
    expect(new URL(route.request().url()).pathname).toBe(`/api${endpoint}`)
    expect(new URL(route.request().url()).search).toBe('')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    if (route.request().method() === 'PATCH' && patch) await patch(route)
    else { expect(route.request().method()).toBe('GET'); await fulfillJson(route, 200, preferences) }
  })
}
async function openEditor(page: Page, action = 'Edit rule') {
  await page.goto('/settings/workflow')
  await page.getByRole('button', { name: action, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox', { name: 'Condition', exact: true })).toBeFocused()
  return dialog
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockPreferences(page)
})

test('workflow settings reflects the inclusive TTC threshold and only supported routing', async ({ page }) => {
  let requests = 0
  page.on('request', (request) => { if (request.resourceType() === 'fetch' && !/users\/me|notifications/.test(request.url())) requests++ })
  await page.goto('/settings/workflow?organizationId=999')
  await expect(activeRule(page).getByRole('heading')).toHaveText('Invoices ≥ 1,000.00')
  await expect(activeRule(page)).toContainText('Any member with validation access')
  await expect(page.getByText('Invoices below 1,000.00 skip approval. Invoices exactly at the threshold require approval.')).toBeVisible()
  await expect(page.getByText(/Multiple rules, project-specific conditions, named approvers and sequential steps are not available yet/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Add rule|Duplicate|Add approver/ })).toHaveCount(0)
  await expect(page.getByText(/Marie Laurent|Department manager|Résidence Bellevue/)).toHaveCount(0)
  expect(requests).toBe(1)
})

for (const preferences of [allRule, { validationRequired: true }]) {
  test(`workflow settings reads all-invoice approval with ${'validationThreshold' in preferences ? 'null' : 'omitted'} threshold`, async ({ page }) => {
    await mockPreferences(page, preferences)
    await page.goto('/settings/workflow')
    await expect(activeRule(page).getByRole('heading')).toHaveText('All invoices')
    await expect(page.getByText('All submitted invoices require approval.', { exact: true })).toBeVisible()
  })
}

test('workflow settings shows disabled approval without inventing a saved rule', async ({ page }, testInfo) => {
  await mockPreferences(page, disabledRule)
  await page.goto('/settings/workflow')
  await expect(page.getByRole('heading', { name: 'No active approval rule' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add rule', exact: true })).toBeEnabled()
  await expect(activeRule(page)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('workflow-empty.png'), fullPage: true })
})

test('workflow settings waits for the actual preferences before enabling any change', async ({ page }, testInfo) => {
  const pending = deferred()
  await mockApiRoute(page, endpoint, async (route) => { await pending.promise; await fulfillJson(route, 200, amountRule) })
  await page.goto('/settings/workflow')
  await expect(page.getByRole('status', { name: 'Loading approval workflow' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add rule' })).toBeDisabled()
  await expect(activeRule(page)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('workflow-loading.png'), fullPage: true })
  pending.release()
  await expect(activeRule(page)).toBeVisible()
})

for (const status of [403, 404, 500]) {
  test(`workflow settings handles GET ${status} and reloads`, async ({ page }, testInfo) => {
    let failed = true
    await mockApiRoute(page, endpoint, (route) => fulfillJson(route, failed ? status : 200, failed ? {} : amountRule))
    await page.goto('/settings/workflow')
    await expect(page.getByRole('alert')).toContainText(status === 403 ? 'Workflow access denied' : 'Unable to load approval workflow')
    await expect(page.getByRole('button', { name: 'Add rule' })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath(`workflow-error-${status}.png`), fullPage: true })
    failed = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(activeRule(page)).toBeVisible()
  })
}

for (const [name, preferences] of [
  ['null', null], ['missing required flag', {}], ['string flag', { validationRequired: 'true' }],
  ['zero amount', { ...amountRule, validationThreshold: 0 }], ['invalid precision', { ...amountRule, validationThreshold: 100.001 }],
  ['string amount', { ...amountRule, validationThreshold: '1000' }], ['oversized amount', { ...amountRule, validationThreshold: 10000000000 }],
  ['disabled with threshold', { ...amountRule, validationRequired: false }],
] as const) {
  test(`workflow settings rejects invalid preferences: ${name}`, async ({ page }) => {
    await mockPreferences(page, preferences)
    await page.goto('/settings/workflow')
    await expect(page.getByRole('alert')).toContainText('Unable to load approval workflow')
    await expect(activeRule(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add rule' })).toBeDisabled()
  })
}

for (const code of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`workflow settings is read-only for ${code}`, async ({ page }, testInfo) => {
    let writes = 0
    page.on('request', (request) => { if (request.method() === 'PATCH') writes++ })
    await mockCurrentUser(page, { ...currentUser, role: { id: 2, code, label: 'Accounting' } })
    await page.goto('/settings/workflow')
    await expect(activeRule(page)).toBeVisible()
    await expect(page.getByText(/You have read-only access/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Add rule|Edit rule|Disable/ })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('workflow-read-only.png'), fullPage: true })
    expect(writes).toBe(0)
  })
}

test('workflow settings adds one rule with the exact payload only after server confirmation', async ({ page }, testInfo) => {
  const pending = deferred()
  let writes = 0
  await mockPreferences(page, disabledRule, async (route) => {
    writes++
    expect(route.request().postDataJSON()).toEqual({ validationRequired: true, validationThreshold: 1250.5 })
    await pending.promise
    await fulfillJson(route, 200, { ...amountRule, validationThreshold: 1250.5 })
  })
  const dialog = await openEditor(page, 'Add rule')
  const amount = dialog.getByRole('textbox', { name: 'Amount (incl. tax)', exact: true })
  await expect(amount).toHaveValue('')
  await amount.fill(' 1250,50 ')
  await expect(dialog.getByText(/currencies are not converted/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Save rule' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(dialog.getByRole('form')).toHaveAttribute('aria-busy', 'true')
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('article', { name: 'Active approval rule', includeHidden: true })).toHaveCount(0)
  await expect(page.getByText('Approval rule saved.', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('workflow-saving.png') })
  pending.release()
  await expect(dialog).toHaveCount(0)
  await expect(activeRule(page).getByRole('heading')).toHaveText('Invoices ≥ 1,250.50')
  await expect(page.getByText('Approval rule saved.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload workflow' })).toBeFocused()
  expect(writes).toBe(1)
  await page.screenshot({ path: testInfo.outputPath('workflow-success.png'), fullPage: true })
})

test('workflow settings switches from amount to every invoice by omitting the threshold', async ({ page }) => {
  await mockPreferences(page, amountRule, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ validationRequired: true })
    await fulfillJson(route, 200, allRule)
  })
  const dialog = await openEditor(page)
  await expect(dialog.getByRole('button', { name: 'Save rule' })).toBeDisabled()
  await dialog.getByRole('combobox', { name: 'Condition', exact: true }).click()
  await page.getByRole('option', { name: 'All invoices', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Amount (incl. tax)' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Save rule' }).click()
  await expect(activeRule(page).getByRole('heading')).toHaveText('All invoices')
  await expect(page.getByRole('button', { name: 'Edit rule' })).toBeFocused()
})

for (const value of ['', '0', '-1', '100.001', '1e3', 'NaN', 'Infinity', '10000000000', '1,2,3']) {
  test(`workflow settings refuses incomplete or invalid amount ${JSON.stringify(value)}`, async ({ page }) => {
    let writes = 0
    await mockPreferences(page, disabledRule, async (route) => { writes++; await fulfillJson(route, 200, allRule) })
    const dialog = await openEditor(page, 'Add rule')
    const amount = dialog.getByRole('textbox', { name: 'Amount (incl. tax)', exact: true })
    await amount.fill(value)
    await dialog.getByRole('button', { name: 'Save rule' }).click()
    await expect(amount).toHaveAttribute('aria-invalid', 'true')
    await expect(amount).toBeFocused()
    await expect(amount).toHaveAccessibleDescription(/Enter an amount greater than zero/)
    expect(writes).toBe(0)
    await expect(page.getByText('Approval rule saved.', { exact: true })).toHaveCount(0)
  })
}

for (const amount of [0.01, 9999999999.99]) {
  test(`workflow settings accepts the valid boundary ${amount}`, async ({ page }) => {
    await mockPreferences(page, allRule, async (route) => {
      expect(route.request().postDataJSON()).toEqual({ validationRequired: true, validationThreshold: amount })
      await fulfillJson(route, 200, { ...amountRule, validationThreshold: amount })
    })
    const dialog = await openEditor(page)
    await dialog.getByRole('combobox', { name: 'Condition' }).click()
    await page.getByRole('option', { name: 'Invoice amount', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Amount (incl. tax)' }).fill(String(amount))
    await dialog.getByRole('button', { name: 'Save rule' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Approval rule saved.', { exact: true })).toBeVisible()
  })
}

test('workflow settings cancels the editor, restores focus and discards its draft', async ({ page }) => {
  let writes = 0
  page.on('request', (request) => { if (request.method() === 'PATCH') writes++ })
  let dialog = await openEditor(page)
  await dialog.getByRole('textbox', { name: 'Amount (incl. tax)' }).fill('2000')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Edit rule' })).toBeFocused()
  await page.keyboard.press('Enter')
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('textbox', { name: 'Amount (incl. tax)' })).toHaveValue('1000')
  await expect(dialog.getByRole('button', { name: 'Save rule' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(writes).toBe(0)
})

test('workflow settings shows server validation on the amount and preserves its draft', async ({ page }, testInfo) => {
  let failed = true
  await mockPreferences(page, amountRule, (route) => fulfillJson(route, failed ? 400 : 200, failed ? { code: 'ORGANIZATION_VALIDATION_ERROR', message: 'validationThreshold is too large' } : { ...amountRule, validationThreshold: 2000 }))
  const dialog = await openEditor(page)
  const amount = dialog.getByRole('textbox', { name: 'Amount (incl. tax)' })
  await amount.fill('2000')
  await dialog.getByRole('button', { name: 'Save rule' }).click()
  await expect(amount).toBeFocused()
  await expect(amount).toHaveAccessibleDescription('This amount was rejected. Check its value and precision.')
  await expect(amount).toHaveValue('2000')
  await page.screenshot({ path: testInfo.outputPath('workflow-validation.png') })
  failed = false
  await dialog.getByRole('button', { name: 'Save rule' }).click()
  await expect(activeRule(page).getByRole('heading')).toHaveText('Invoices ≥ 2,000.00')
})

for (const status of [403, 404, 409, 500, 501]) {
  test(`workflow settings handles PATCH ${status} without claiming success`, async ({ page }, testInfo) => {
    await mockPreferences(page, amountRule, (route) => fulfillJson(route, status, { code: 'FAILED' }))
    const dialog = await openEditor(page)
    await dialog.getByRole('textbox', { name: 'Amount (incl. tax)' }).fill('2000')
    await dialog.getByRole('button', { name: 'Save rule' }).click()
    await expect(dialog.getByRole('alert')).toContainText(status === 403 ? 'no longer have permission' : status === 409 ? 'conflict' : status === 500 ? 'could not be confirmed' : 'currently unavailable')
    await expect(dialog.getByRole('button', { name: 'Save rule' })).toBeDisabled()
    await expect(page.getByText('Approval rule saved.', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('article', { name: 'Active approval rule', includeHidden: true })).toContainText('Invoices ≥ 1,000.00')
    await page.screenshot({ path: testInfo.outputPath(`workflow-patch-${status}.png`) })
    await dialog.getByRole('button', { name: 'Reload workflow' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(activeRule(page).getByRole('heading')).toHaveText('Invoices ≥ 1,000.00')
  })
}

for (const failure of ['network', 'invalid response']) {
  test(`workflow settings reconciles ${failure} through reload`, async ({ page }) => {
    let saved = false
    await mockApiRoute(page, endpoint, async (route) => {
      if (route.request().method() === 'GET') return fulfillJson(route, 200, saved ? allRule : amountRule)
      saved = true
      if (failure === 'network') await route.abort('failed')
      else await fulfillJson(route, 200, {})
    })
    const dialog = await openEditor(page)
    await dialog.getByRole('combobox', { name: 'Condition' }).click()
    await page.getByRole('option', { name: 'All invoices', exact: true }).click()
    await dialog.getByRole('button', { name: 'Save rule' }).click()
    await expect(dialog.getByRole('alert')).toContainText('could not be confirmed')
    await expect(page.getByText('Approval rule saved.', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Reload workflow' }).click()
    await expect(activeRule(page).getByRole('heading')).toHaveText('All invoices')
  })
}

test('workflow settings confirms disabling and only clears the threshold after the response', async ({ page }, testInfo) => {
  const pending = deferred()
  let writes = 0
  await mockPreferences(page, amountRule, async (route) => {
    writes++
    expect(route.request().postDataJSON()).toEqual({ validationRequired: false })
    await pending.promise
    await fulfillJson(route, 200, disabledRule)
  })
  await page.goto('/settings/workflow')
  await page.getByRole('button', { name: 'Disable', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Disable approval?' })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await expect(dialog).toContainText('The current threshold will be removed.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect(writes).toBe(0)
  await page.getByRole('button', { name: 'Disable', exact: true }).click()
  dialog = page.getByRole('dialog')
  await page.screenshot({ path: testInfo.outputPath('workflow-disable.png') })
  await dialog.getByRole('button', { name: 'Disable approval', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(page.getByRole('article', { name: 'Active approval rule', includeHidden: true })).toBeAttached()
  pending.release()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No active approval rule' })).toBeVisible()
  await expect(page.getByText('Approval disabled.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add rule' }).click()
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Amount (incl. tax)' })).toHaveValue('')
})

for (const method of ['GET', 'PATCH']) {
  test(`workflow settings clears expired authentication on ${method}`, async ({ page }) => {
    await mockApiRoute(page, endpoint, (route) => fulfillJson(route, route.request().method() === method ? 401 : 200, amountRule))
    if (method === 'GET') await page.goto('/settings/workflow')
    else {
      const dialog = await openEditor(page)
      await dialog.getByRole('textbox', { name: 'Amount (incl. tax)' }).fill('2000')
      await dialog.getByRole('button', { name: 'Save rule' }).click()
    }
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
  })
}

test('workflow settings ignores a save response after navigating away', async ({ page }) => {
  const pending = deferred()
  await mockPreferences(page, amountRule, async (route) => { await pending.promise; await fulfillJson(route, 200, allRule) })
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, []))
  const dialog = await openEditor(page)
  await dialog.getByRole('textbox', { name: 'Amount (incl. tax)' }).fill('2000')
  await dialog.getByRole('button', { name: 'Save rule' }).click()
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await page.goto('/settings/roles')
  pending.release()
  await expect(page.getByRole('heading', { name: 'No roles available' })).toBeVisible()
  await expect(page.getByText('Approval rule saved.', { exact: true })).toHaveCount(0)
})

test('workflow settings ignores a response from an earlier visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 })
  const pending = deferred()
  let reads = 0
  await mockApiRoute(page, endpoint, async (route) => {
    const previous = ++reads === 1
    if (previous) await pending.promise
    await fulfillJson(route, 200, previous ? amountRule : disabledRule)
  })
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, []))
  await page.goto('/settings/workflow')
  await expect(page.getByRole('status', { name: 'Loading approval workflow' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Settings categories' })
  await nav.getByRole('link', { name: 'Roles & permissions', exact: true }).click()
  await nav.getByRole('link', { name: 'Approval workflow', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No active approval rule' })).toBeVisible()
  pending.release()
  await expect(activeRule(page)).toHaveCount(0)
})

for (const width of [1440, 768, 390]) {
  test(`workflow settings follows Figma and keeps the sheet usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1024 })
    await page.goto('/settings/workflow')
    await expect(activeRule(page)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`workflow-${width}.png`), fullPage: true })
    if (width < 1024) {
      await page.getByRole('link', { name: 'All settings', exact: true }).click()
      await page.getByRole('navigation', { name: 'Settings categories' }).getByRole('link', { name: 'Approval workflow', exact: true }).click()
    } else await expect(page.getByRole('navigation', { name: 'Settings categories' }).getByRole('link', { name: 'Approval workflow', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'Edit rule', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('combobox', { name: 'Condition' })).toBeFocused()
    await expect(dialog).toHaveCSS('width', `${Math.min(width, 480)}px`)
    const save = dialog.getByRole('button', { name: 'Save rule' })
    await expect(save).toBeInViewport({ ratio: 1 })
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`workflow-editor-${width}.png`) })
    await dialog.getByRole('combobox', { name: 'Condition' }).press('Space')
    await expect(page.getByRole('option', { name: 'Invoice amount', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: 'All invoices', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog.getByRole('textbox', { name: 'Amount (incl. tax)' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Edit rule' })).toBeFocused()
    if (width === 390) {
      await page.setViewportSize({ width, height: 600 })
      await page.getByRole('button', { name: 'Edit rule' }).click()
      await expect(save).toBeInViewport({ ratio: 1 })
      await dialog.getByText('Named approvers and sequential steps are not available yet.').scrollIntoViewIfNeeded()
      await expect(save).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: testInfo.outputPath('workflow-editor-small-height.png') })
    }
  })
}

test('workflow preferences remain compatible with the onboarding consumer', async ({ page }) => {
  await mockPreferences(page, allRule)
  await page.goto('/onboarding/workflow')
  await expect(page.getByRole('radio', { name: /Single approval step/ })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()
})
