import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

import { AUTH_TOKEN_STORAGE_KEY, currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const admin = { id: 1, firstName: 'Alex', lastName: 'Martin', email: 'alex.martin@example.com', role: currentUser.role, active: true }
const invited = { id: 20, firstName: 'Camille', lastName: 'Dubois', email: 'camille.dubois@example.com', role: { id: 2, code: 'OPERATEUR_COMPTABLE', label: 'Accounting operator' }, active: false }
const roles = [admin.role, invited.role, { id: 3, code: 'RESPONSABLE_COMPTABLE', label: 'Accounting manager' }].map(({ code, label }) => ({ code, label }))
const pageData = (content = [admin]) => ({ content, number: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 })
const trigger = (page: Page) => page.getByRole('button', { name: 'Invite member', exact: true })
const deferred = () => { let release = () => {}; const promise = new Promise<void>((resolve) => { release = resolve }); return { release, promise } }

async function openInvitation(page: Page, query = '') {
  await page.goto(`/settings/members${query}`)
  await trigger(page).click()
  const dialog = page.getByRole('dialog', { name: 'Invite member', exact: true })
  await expect(dialog.getByLabel('Email', { exact: true })).toBeFocused()
  return dialog
}
async function fillInvitation(page: Page, dialog: Locator, chooseRole = true) {
  await dialog.getByLabel('Email', { exact: true }).fill(invited.email)
  await dialog.getByLabel('First name', { exact: true }).fill(invited.firstName)
  await dialog.getByLabel('Last name', { exact: true }).fill(invited.lastName)
  if (chooseRole) {
    await dialog.getByRole('combobox', { name: 'Role', exact: true }).click()
    await page.getByRole('option', { name: invited.role.label, exact: true }).click()
  }
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/users?*', (route) => fulfillJson(route, 200, pageData()))
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, roles))
})

test('member invitation sends the exact normalized payload once and updates only after confirmation', async ({ page }, testInfo) => {
  const pending = deferred()
  let creates = 0
  await mockApiRoute(page, '/v1/users', async (route) => {
    creates++
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(new URL(route.request().url()).search).toBe('')
    expect(route.request().postDataJSON()).toEqual({ email: invited.email, firstName: invited.firstName, lastName: invited.lastName, roleCode: invited.role.code })
    await pending.promise
    await fulfillJson(route, 201, invited)
  })
  const dialog = await openInvitation(page, '?status=active&q=alex&page=99&organizationId=999')
  await fillInvitation(page, dialog)
  await dialog.getByLabel('Email', { exact: true }).fill(' CAMILLE.DUBOIS@EXAMPLE.COM ')
  await dialog.getByLabel('First name', { exact: true }).fill(' Camille ')
  await dialog.getByLabel('Last name', { exact: true }).fill(' Dubois ')
  await expect(dialog.getByText('The member will be added as inactive. No invitation email will be sent.')).toBeVisible()
  await expect(dialog.getByLabel('Optional message', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(dialog.getByRole('form')).toHaveAttribute('aria-busy', 'true')
  await expect(dialog.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('row', { includeHidden: true }).filter({ hasText: invited.email })).toHaveCount(0)
  await expect(page.getByText('Invitation created. The member is inactive.', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('invitation-saving.png'), fullPage: true })
  pending.release()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Invitation created. The member is inactive.', { exact: true })).toBeVisible()
  const memberRow = page.getByRole('row').filter({ hasText: invited.email })
  await expect(memberRow.getByText('Inactive', { exact: true })).toBeVisible()
  await expect(memberRow.getByText(invited.role.label, { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Search members' })).toHaveValue(invited.email)
  const params = new URL(page.url()).searchParams
  expect(params.has('status')).toBe(false)
  expect(params.has('page')).toBe(false)
  expect(creates).toBe(1)
  await expect(trigger(page)).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('invitation-success.png'), fullPage: true })
  await page.getByRole('textbox', { name: 'Search members' }).fill('')
  await expect(page.getByText('1–2 of 2 members', { exact: true })).toBeVisible()
})

test('member invitation cancels with keyboard and resets the next invitation', async ({ page }) => {
  let creates = 0
  page.on('request', (request) => { if (request.method() === 'POST') creates++ })
  let dialog = await openInvitation(page)
  await fillInvitation(page, dialog)
  await page.keyboard.press('Escape')
  await expect(trigger(page)).toBeFocused()
  await page.keyboard.press('Enter')
  dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('')
  await expect(dialog.getByRole('combobox', { name: 'Role', exact: true })).toHaveText('Select a role')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(trigger(page)).toBeFocused()
  expect(creates).toBe(0)
})

for (const [label, value, message] of [
  ['Email', 'invalid@domain', 'Enter a valid email address.'],
  ['First name', ' ', 'Enter a first name.'],
  ['Last name', ' ', 'Enter a last name.'],
  ['Role', '', 'Select an initial role.'],
]) {
  test(`member invitation validates ${label} before submitting`, async ({ page }) => {
    let creates = 0
    page.on('request', (request) => { if (request.method() === 'POST') creates++ })
    const dialog = await openInvitation(page)
    await fillInvitation(page, dialog, label !== 'Role')
    const control = label === 'Role' ? dialog.getByRole('combobox', { name: 'Role', exact: true }) : dialog.getByLabel(label, { exact: true })
    if (label !== 'Role') await control.fill(value)
    await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
    await expect(control).toBeFocused()
    await expect(control).toHaveAttribute('aria-invalid', 'true')
    await expect(control).toHaveAccessibleDescription(new RegExp(message.replaceAll('.', '\\.')))
    expect(creates).toBe(0)
  })
}

test('member invitation does not steal focus while correcting several validation errors', async ({ page }) => {
  const dialog = await openInvitation(page)
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
  const email = dialog.getByLabel('Email', { exact: true })
  await expect(email).toBeFocused()
  await page.keyboard.type('camille')
  await expect(email).toBeFocused()
  await expect(email).toHaveValue('camille')
})

test('member invitation displays the backend email conflict without leaking another organization', async ({ page }, testInfo) => {
  let failed = true
  await mockApiRoute(page, '/v1/users', (route) => fulfillJson(route, failed ? 409 : 201, failed ? { code: 'USER_EMAIL_CONFLICT', message: 'Already used' } : invited))
  const dialog = await openInvitation(page)
  await fillInvitation(page, dialog)
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
  const email = dialog.getByLabel('Email', { exact: true })
  await expect(email).toBeFocused()
  await expect(email).toHaveAccessibleDescription('A user already uses this email address.')
  await expect(email).toHaveValue(invited.email)
  await expect(dialog.getByLabel('First name', { exact: true })).toHaveValue(invited.firstName)
  await page.screenshot({ path: testInfo.outputPath('invitation-conflict.png'), fullPage: true })
  failed = false
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: invited.email })).toBeVisible()
})

for (const [field, label] of [['email', 'Email'], ['firstName', 'First name'], ['lastName', 'Last name'], ['roleCode', 'Role']]) {
  test(`member invitation associates backend validation with ${field}`, async ({ page }) => {
    await mockApiRoute(page, '/v1/users', (route) => fulfillJson(route, 400, { code: 'USER_VALIDATION_ERROR', message: `${field} is invalid` }))
    const dialog = await openInvitation(page)
    await fillInvitation(page, dialog)
    await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
    const control = label === 'Role' ? dialog.getByRole('combobox', { name: 'Role', exact: true }) : dialog.getByLabel(label, { exact: true })
    await expect(control).toBeFocused()
    await expect(control).toHaveAttribute('aria-invalid', 'true')
    await expect(dialog.getByRole('button', { name: 'Create invitation', exact: true })).toBeEnabled()
    await expect(page.getByText('Invitation created. The member is inactive.', { exact: true })).toHaveCount(0)
  })
}

for (const status of [403, 500]) {
  test(`member invitation loads roles, handles ${status} and retries without losing input`, async ({ page }, testInfo) => {
    const pending = deferred()
    let failed = true
    await mockApiRoute(page, '/v1/roles', async (route) => {
      expect(route.request().method()).toBe('GET')
      expect(route.request().headers().authorization).toBe('Bearer e2e-token')
      await pending.promise
      await fulfillJson(route, failed ? status : 200, failed ? {} : roles)
    })
    const dialog = await openInvitation(page)
    await expect(dialog.getByRole('status')).toHaveText('Loading roles…')
    await expect(dialog.getByRole('button', { name: 'Create invitation', exact: true })).toBeDisabled()
    await fillInvitation(page, dialog, false)
    await page.screenshot({ path: testInfo.outputPath('invitation-roles-loading.png'), fullPage: true })
    pending.release()
    await expect(dialog.getByRole('alert')).toContainText(status === 403 ? 'Only administrators can load roles and invite members.' : 'Unable to load available roles.')
    await page.screenshot({ path: testInfo.outputPath('invitation-roles-error.png'), fullPage: true })
    failed = false
    await dialog.getByRole('button', { name: 'Retry roles', exact: true }).click()
    await expect(dialog.getByRole('combobox', { name: 'Role', exact: true })).toBeEnabled()
    await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue(invited.email)
    await dialog.getByRole('combobox', { name: 'Role', exact: true }).click()
    await page.getByRole('option', { name: invited.role.label, exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Create invitation', exact: true })).toBeEnabled()
  })
}

for (const response of [[], [{ code: 'SUPER_ADMIN', label: 'Unsupported role' }]]) {
  test(`member invitation has no invented fallback for ${response.length ? 'unsupported' : 'empty'} roles`, async ({ page }, testInfo) => {
    await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, response))
    const dialog = await openInvitation(page)
    await expect(dialog.getByRole('status')).toHaveText('No roles are available for invitation. Contact an administrator.')
    await expect(dialog.getByRole('button', { name: 'Create invitation', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('combobox', { name: 'Role', exact: true })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath('invitation-empty-roles.png'), fullPage: true })
  })
}

test('member invitation uses only roles and labels returned by the API', async ({ page }) => {
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, [{ code: 'RESPONSABLE_COMPTABLE', label: 'Finance lead' }]))
  await mockApiRoute(page, '/v1/users', async (route) => {
    expect(route.request().postDataJSON().roleCode).toBe('RESPONSABLE_COMPTABLE')
    await fulfillJson(route, 201, { ...invited, role: { id: 3, code: 'RESPONSABLE_COMPTABLE', label: 'Finance lead' } })
  })
  const dialog = await openInvitation(page)
  await fillInvitation(page, dialog, false)
  await dialog.getByRole('combobox', { name: 'Role', exact: true }).click()
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.getByRole('option', { name: 'Finance lead', exact: true }).click()
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: invited.email }).getByText('Finance lead', { exact: true })).toBeVisible()
})

for (const status of [400, 403, 404, 405, 409, 500, 501]) {
  test(`member invitation handles POST ${status} without adding a member`, async ({ page }) => {
    await mockApiRoute(page, '/v1/users', (route) => fulfillJson(route, status, { message: 'Rejected' }))
    const dialog = await openInvitation(page)
    await fillInvitation(page, dialog)
    await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue(invited.email)
    if ([403, 404, 405, 501].includes(status)) await expect(dialog.getByRole('button', { name: 'Create invitation', exact: true })).toBeDisabled()
    else await expect(dialog.getByRole('button', { name: 'Create invitation', exact: true })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: invited.email })).toHaveCount(0)
    await expect(page.getByText('1–1 of 1 members', { exact: true })).toBeVisible()
    await expect(page.getByText('Invitation created. The member is inactive.', { exact: true })).toHaveCount(0)
  })
}

for (const failure of ['network', 'invalid response']) {
  test(`member invitation does not claim success after ${failure}`, async ({ page }) => {
    await mockApiRoute(page, '/v1/users', (route) => failure === 'network' ? route.abort() : fulfillJson(route, 201, {}))
    const dialog = await openInvitation(page)
    await fillInvitation(page, dialog)
    await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Unable to confirm the invitation.')
    await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue(invited.email)
    await expect(page.getByText('Invitation created. The member is inactive.', { exact: true })).toHaveCount(0)
  })
}

for (const endpoint of ['/v1/users', '/v1/roles']) {
  test(`member invitation clears an expired session on ${endpoint}`, async ({ page }) => {
    await mockApiRoute(page, endpoint, (route) => fulfillJson(route, 401, {}))
    await page.goto('/settings/members')
    await trigger(page).click()
    if (endpoint === '/v1/users') {
      const dialog = page.getByRole('dialog')
      await fillInvitation(page, dialog)
      await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
    }
    await expect(page).toHaveURL('/login')
    expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
  })
}

test('member invitation is unavailable while the member list is loading or denied', async ({ page }) => {
  const pending = deferred()
  await mockApiRoute(page, '/v1/users?*', async (route) => { await pending.promise; await fulfillJson(route, 403, {}) })
  await page.goto('/settings/members')
  await expect(page.getByRole('status', { name: 'Loading members' })).toBeVisible()
  await expect(trigger(page)).toBeDisabled()
  pending.release()
  await expect(page.getByText('Member access denied', { exact: true })).toBeVisible()
  await expect(trigger(page)).toBeDisabled()
})

test('member invitation can add the first member to an empty list', async ({ page }) => {
  await mockApiRoute(page, '/v1/users?*', (route) => fulfillJson(route, 200, pageData([])))
  await mockApiRoute(page, '/v1/users', (route) => fulfillJson(route, 201, invited))
  const dialog = await openInvitation(page)
  await fillInvitation(page, dialog)
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: invited.email })).toBeVisible()
  await expect(page.getByText('1–1 of 1 members', { exact: true })).toBeVisible()
})

test('member invitation ignores creation after navigating away', async ({ page }) => {
  const pending = deferred()
  const sent = deferred()
  await mockApiRoute(page, '/v1/users', async (route) => { await pending.promise; await fulfillJson(route, 201, invited); sent.release() })
  const dialog = await openInvitation(page)
  await fillInvitation(page, dialog)
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Creating…', exact: true })).toBeVisible()
  await page.evaluate(() => { history.pushState(null, '', '/integrations'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()
  pending.release()
  await sent.promise
  await expect(page.getByText('Invitation created. The member is inactive.', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('link', { name: 'Members', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: invited.email })).toHaveCount(0)
})

test('member invitation ignores old role responses after reopening', async ({ page }) => {
  const pending = deferred()
  const sent = deferred()
  let requests = 0
  await mockApiRoute(page, '/v1/roles', async (route: Route) => {
    const old = ++requests === 1
    if (old) await pending.promise
    await fulfillJson(route, 200, old ? [roles[0]] : [roles[1]])
    if (old) sent.release()
  })
  const dialog = await openInvitation(page)
  await expect(dialog.getByRole('status')).toHaveText('Loading roles…')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await trigger(page).click()
  await page.getByRole('combobox', { name: 'Role', exact: true }).click()
  await expect(page.getByRole('option', { name: invited.role.label, exact: true })).toBeVisible()
  pending.release()
  await sent.promise
  await expect(page.getByRole('option')).toHaveCount(1)
  await expect(page.getByRole('option', { name: 'Administrator', exact: true })).toHaveCount(0)
})

for (const width of [1440, 768, 390]) {
  test(`member invitation follows the responsive dialog at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 })
    const dialog = await openInvitation(page)
    await expect(dialog.getByRole('button', { name: 'Create invitation', exact: true })).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`invitation-${width}.png`), fullPage: true })
    const email = dialog.getByLabel('Email', { exact: true })
    await email.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(email).toBeFocused()
    if (width === 390) {
      await page.setViewportSize({ width, height: 600 })
      await expect(dialog).toBeInViewport({ ratio: 1 })
      await dialog.getByRole('button', { name: 'Create invitation', exact: true }).scrollIntoViewIfNeeded()
      await expect(dialog.getByRole('button', { name: 'Create invitation', exact: true })).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: testInfo.outputPath('invitation-small-height.png'), animations: 'disabled' })
    }
    await page.keyboard.press('Escape')
    await expect(trigger(page)).toBeFocused()
  })
}
