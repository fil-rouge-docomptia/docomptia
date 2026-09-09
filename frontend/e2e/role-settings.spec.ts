import { expect, test, type Page } from '@playwright/test'

import { AUTH_TOKEN_STORAGE_KEY, currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const admin = { ...currentUser, active: true }
const accountant = { id: 2, firstName: 'Émilie', lastName: 'Durand', email: 'emilie@example.com', role: { id: 2, code: 'OPERATEUR_COMPTABLE', label: 'Accounting operator' }, active: true }
const otherAdmin = { ...admin, id: 3, firstName: 'Marie', lastName: 'Bernard', email: 'marie@example.com' }
const roles = [admin.role, accountant.role, { code: 'RESPONSABLE_COMPTABLE', label: 'Accounting manager' }].map(({ code, label }) => ({ code, label }))
const pageData = (content = [admin, accountant, otherAdmin]) => ({ content, number: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 })
const selectedRole = (page: Page) => page.getByRole('region', { name: 'Selected role', exact: true })
const deferred = () => { let release = () => {}; const promise = new Promise<void>((resolve) => { release = resolve }); return { release, promise } }

async function openRole(page: Page, code = 'ADMIN') {
  await page.goto(`/settings/roles?role=${code}`)
  await expect(selectedRole(page)).toBeVisible()
}
async function openAssignment(page: Page, member = otherAdmin) {
  await openRole(page)
  await page.getByRole('link', { name: 'Manage member roles', exact: true }).click()
  await page.getByRole('button', { name: `Actions for ${member.firstName} ${member.lastName}` }).click()
  await page.getByRole('menuitem', { name: 'Change role', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Role', exact: true }).click()
  await page.getByRole('option', { name: accountant.role.label, exact: true }).click()
  return dialog
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, roles))
  await mockApiRoute(page, '/v1/users?*', (route) => fulfillJson(route, 200, pageData()))
})

test('role settings loads only backend roles and keeps permission details explicitly unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 })
  const requests: string[] = []
  page.on('request', (request) => { if (/\/roles|\/permissions/.test(request.url()) && request.resourceType() === 'fetch') requests.push(request.url()) })
  const supplied = [{ code: 'REVIEWER', label: 'External reviewer' }, { code: 'ADMIN', label: 'Workspace administrator' }]
  await mockApiRoute(page, '/v1/roles', async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(new URL(route.request().url()).search).toBe('')
    await fulfillJson(route, 200, supplied)
  })
  await page.goto('/settings/roles?organizationId=999')
  await expect(page.getByRole('navigation', { name: 'Available roles' }).getByRole('link')).toHaveText(supplied.map(({ label }) => label))
  await expect(selectedRole(page).getByRole('heading', { name: 'External reviewer', exact: true })).toBeVisible()
  await expect(selectedRole(page)).toContainText('Permission details unavailable')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /save|edit|create/i })).toHaveCount(0)
  await expect(page.getByText(/full organization access|Owner|Viewer|Validator|Accounting operator/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Manage member roles' })).toHaveAttribute('href', '/settings/members?role=REVIEWER')
  expect(requests).toHaveLength(1)
})

test('role settings waits for the real role response', async ({ page }, testInfo) => {
  const pending = deferred()
  await mockApiRoute(page, '/v1/roles', async (route) => { await pending.promise; await fulfillJson(route, 200, roles) })
  await page.goto('/settings/roles')
  await expect(page.getByRole('status', { name: 'Loading roles' })).toBeVisible()
  await expect(selectedRole(page)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Manage member roles' })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('roles-loading.png'), fullPage: true })
  pending.release()
  await expect(selectedRole(page).getByRole('heading', { name: roles[0].label, exact: true })).toBeVisible()
})

test('role settings switches by keyboard and restores selected roles with browser history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 })
  await openRole(page)
  const navigation = page.getByRole('navigation', { name: 'Available roles' })
  const operator = navigation.getByRole('link', { name: accountant.role.label, exact: true })
  await operator.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/role=OPERATEUR_COMPTABLE$/)
  await expect(operator).toHaveAttribute('aria-current', 'page')
  await expect(selectedRole(page).getByRole('heading', { name: accountant.role.label, exact: true })).toBeVisible()
  await page.goBack()
  await expect(navigation.getByRole('link', { name: admin.role.label, exact: true })).toHaveAttribute('aria-current', 'page')
  await page.goForward()
  await page.reload()
  await expect(selectedRole(page).getByRole('heading', { name: accountant.role.label, exact: true })).toBeVisible()
})

test('role settings does not substitute a different role for a stale URL', async ({ page }) => {
  await page.goto('/settings/roles?role=REMOVED&context=keep')
  await expect(page.getByRole('heading', { name: 'Role unavailable', exact: true })).toBeVisible()
  await expect(selectedRole(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Select an available role', exact: true }).click()
  await expect(page).toHaveURL(/role=ADMIN&context=keep$/)
  await expect(selectedRole(page)).toBeVisible()
})

test('role settings shows an empty catalogue without a frontend fallback and can reload', async ({ page }, testInfo) => {
  let empty = true
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, empty ? [] : roles))
  await page.goto('/settings/roles')
  await expect(page.getByRole('heading', { name: 'No roles available', exact: true })).toBeVisible()
  await expect(selectedRole(page)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('roles-empty.png'), fullPage: true })
  empty = false
  await page.getByRole('button', { name: 'Reload roles' }).click()
  await expect(selectedRole(page)).toBeVisible()
})

for (const [name, data] of [
  ['object', {}], ['null', null], ['null entry', [null]], ['missing label', [{ code: 'ADMIN' }]],
  ['blank code', [{ code: ' ', label: 'Invalid' }]], ['blank label', [{ code: 'ADMIN', label: ' ' }]],
  ['duplicate code', [roles[0], roles[0]]],
] as const) {
  test(`role settings rejects a malformed catalogue: ${name}`, async ({ page }) => {
    await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, data))
    await page.goto('/settings/roles')
    await expect(page.getByRole('alert')).toContainText('Unable to load roles')
    await expect(selectedRole(page)).toHaveCount(0)
  })
}

for (const status of [403, 404, 500]) {
  test(`role settings handles HTTP ${status} with retry`, async ({ page }, testInfo) => {
    let failed = true
    await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, failed ? status : 200, failed ? { message: 'Failed' } : roles))
    await page.goto('/settings/roles?role=OPERATEUR_COMPTABLE')
    await expect(page.getByRole('alert')).toContainText(status === 403 ? 'Role access denied' : 'Unable to load roles')
    await expect(selectedRole(page)).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`roles-${status}.png`), fullPage: true })
    failed = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(selectedRole(page).getByRole('heading', { name: accountant.role.label, exact: true })).toBeVisible()
  })
}

test('role settings handles network failures', async ({ page }) => {
  await mockApiRoute(page, '/v1/roles', (route) => route.abort('failed'))
  await page.goto('/settings/roles')
  await expect(page.getByRole('alert')).toContainText('Unable to load roles')
})

test('role settings redirects an expired session and clears its token', async ({ page }) => {
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 401, {}))
  await page.goto('/settings/roles')
  await expect(page).toHaveURL(/\/login/)
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
})

for (const code of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`role settings denies ${code} without requesting administrative data`, async ({ page }, testInfo) => {
    let requests = 0
    await mockCurrentUser(page, { ...currentUser, role: { id: 2, code, label: 'Accounting' } })
    await mockApiRoute(page, '/v1/roles', async (route) => { requests++; await fulfillJson(route, 200, roles) })
    await page.goto('/settings/roles')
    await expect(page.getByRole('alert')).toContainText('Role access denied')
    await expect(page.getByRole('navigation', { name: 'Settings categories' }).getByRole('link', { name: 'Roles & permissions', exact: true })).toHaveCount(0)
    expect(requests).toBe(0)
    await page.screenshot({ path: testInfo.outputPath('roles-denied.png'), fullPage: true })
  })
}

test('role settings discards a late response after navigating away', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 })
  const pending = deferred()
  await mockApiRoute(page, '/v1/roles', async (route) => { await pending.promise; await fulfillJson(route, 200, roles) })
  await page.goto('/settings/roles')
  await expect(page.getByRole('status', { name: 'Loading roles' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Settings categories' }).getByRole('link', { name: 'Members', exact: true }).click()
  pending.release()
  await expect(page.getByRole('table', { name: 'Organization members' })).toBeVisible()
  await expect(selectedRole(page)).toHaveCount(0)
})

for (const width of [1440, 768, 390]) {
  test(`role settings follows Figma navigation and stays within ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1024 })
    await openRole(page)
    const categories = page.getByRole('navigation', { name: 'Settings categories' })
    if (width >= 1280) {
      await expect(categories.getByRole('link', { name: 'Roles & permissions', exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('navigation', { name: 'Available roles' })).toBeVisible()
    } else {
      const selector = page.getByRole('combobox', { name: 'Role', exact: true })
      await selector.focus()
      await page.keyboard.press('Space')
      await expect(page.getByRole('option', { name: admin.role.label, exact: true })).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('option', { name: accountant.role.label, exact: true })).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(selector).toBeFocused()
      await expect(selectedRole(page).getByRole('heading', { name: accountant.role.label, exact: true })).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`roles-${width}.png`), fullPage: true })
    if (width < 1024) {
      await page.getByRole('link', { name: 'All settings', exact: true }).click()
      await categories.getByRole('link', { name: 'Roles & permissions', exact: true }).click()
      await expect(selectedRole(page)).toBeVisible()
    }
  })
}

test('role settings links to filtered members, combines filters and keeps the role on return', async ({ page }) => {
  await openRole(page)
  await page.getByRole('link', { name: 'Manage member roles', exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/members\?role=ADMIN$/)
  await expect(page.getByText('1–2 of 2 members', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Actions for Émilie Durand' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Search members' }).fill('marie')
  await expect(page.getByText('1–1 of 1 members', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'View role details', exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/roles\?role=ADMIN$/)
  await page.goBack()
  await page.getByRole('button', { name: 'Show all roles', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show all roles', exact: true })).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('q')).toBe('marie')
  expect(new URL(page.url()).searchParams.has('role')).toBe(false)
  await page.getByRole('textbox', { name: 'Search members' }).fill('')
  await expect(page.getByText('1–3 of 3 members', { exact: true })).toBeVisible()
})

test('role settings keeps unknown member filters empty until explicitly cleared', async ({ page }) => {
  await page.goto('/settings/members?role=REMOVED&page=9')
  await expect(page.getByRole('heading', { name: 'No matching members', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  expect(new URL(page.url()).search).toBe('')
  await expect(page.getByText('1–3 of 3 members', { exact: true })).toBeVisible()
})

test('role settings protects the last active administrator in a filtered member list', async ({ page }) => {
  await mockApiRoute(page, '/v1/users?*', (route) => fulfillJson(route, 200, pageData([admin, accountant, { ...otherAdmin, active: false }])))
  await openRole(page)
  await page.getByRole('link', { name: 'Manage member roles', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search members' }).fill('alex')
  await page.getByRole('button', { name: 'Actions for Alex Martin' }).click()
  await expect(page.getByRole('menuitem', { name: 'Change role', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('menuitem', { name: 'Deactivate member', exact: true })).toHaveAttribute('aria-disabled', 'true')
})

test('role settings changes a filtered member only after backend confirmation', async ({ page }, testInfo) => {
  const pending = deferred()
  let requests = 0
  await mockApiRoute(page, `/v1/users/${otherAdmin.id}/role`, async (route) => {
    requests++
    expect(route.request().method()).toBe('PATCH')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().postDataJSON()).toEqual({ roleCode: accountant.role.code })
    await pending.promise
    await fulfillJson(route, 200, { ...otherAdmin, role: accountant.role })
  })
  const dialog = await openAssignment(page)
  await dialog.getByRole('button', { name: 'Change role', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(dialog.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(page.getByText('Member role updated.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('row', { includeHidden: true }).filter({ hasText: otherAdmin.email })).toContainText(admin.role.label)
  pending.release()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Member role updated.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Actions for Marie Bernard' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Search members' })).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('role-assignment-success.png'), fullPage: true })
  await page.getByRole('button', { name: 'Show all roles' }).click()
  await expect(page.getByRole('row').filter({ hasText: otherAdmin.email })).toContainText(accountant.role.label)
  expect(requests).toBe(1)
})

for (const status of [403, 409]) {
  test(`role settings displays assignment HTTP ${status} without changing the member`, async ({ page }, testInfo) => {
    await mockApiRoute(page, `/v1/users/${otherAdmin.id}/role`, (route) => fulfillJson(route, status, { code: status === 409 ? 'LAST_ACTIVE_ADMINISTRATOR' : 'FORBIDDEN' }))
    const dialog = await openAssignment(page)
    const submit = dialog.getByRole('button', { name: 'Change role', exact: true })
    await submit.click()
    await expect(dialog.getByRole('alert')).toContainText(status === 409 ? 'The last active administrator must keep their role' : 'You no longer have permission')
    await expect(submit).toBeDisabled()
    await expect(page.getByText('Member role updated.', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`role-assignment-${status}.png`), fullPage: true })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: otherAdmin.email })).toContainText(admin.role.label)
  })
}
