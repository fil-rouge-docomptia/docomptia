import { expect, test, type Page, type Route } from '@playwright/test'

import { AUTH_TOKEN_STORAGE_KEY, currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const admin = { id: 1, firstName: 'Alex', lastName: 'Martin', email: 'alex.martin@example.com', role: currentUser.role, active: true }
const accountant = { id: 2, firstName: 'Émilie', lastName: 'Durand', email: 'emilie.durand@example.com', role: { id: 2, code: 'OPERATEUR_COMPTABLE', label: 'Accounting operator' }, active: true }
const inactive = { ...accountant, id: 3, firstName: 'Thomas', lastName: 'Lefèvre', email: 'thomas.lefevre@example.com', active: false }
const otherAdmin = { ...admin, id: 4, firstName: 'Marie', lastName: 'Bernard', email: 'marie.bernard@example.com' }
const members = [otherAdmin, accountant, inactive, admin]
const roles = [admin.role, accountant.role, { id: 3, code: 'RESPONSABLE_COMPTABLE', label: 'Accounting manager' }]
const pageData = (content = members, number = 0, totalElements = content.length, size = 100) => ({ content, number, size, totalElements, totalPages: Math.ceil(totalElements / size) })
const row = (page: Page, email: string) => page.getByRole('row').filter({ hasText: email })
const actions = (page: Page, member = accountant) => page.getByRole('button', { name: `Actions for ${member.firstName} ${member.lastName}`, exact: true })
const deferred = () => { let release = () => {}; const promise = new Promise<void>((resolve) => { release = resolve }); return { release, promise } }

async function mockList(page: Page, handler?: (route: Route) => Promise<void>) {
  await mockApiRoute(page, '/v1/users?*', handler ?? ((route) => fulfillJson(route, 200, pageData())))
}
async function openMembers(page: Page, query = '') {
  await page.goto(`/settings/members${query}`)
  await expect(page.getByRole('table', { name: 'Organization members' })).toBeVisible()
}
async function openAction(page: Page, action: string, member = accountant) {
  await actions(page, member).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
  return page.getByRole('dialog')
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockList(page)
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, roles.map(({ code, label }) => ({ code, label }))))
})

test('member settings loads all organization pages before showing the list', async ({ page }, testInfo) => {
  const pending = deferred()
  const requested: number[] = []
  await mockList(page, async (route) => {
    const params = Object.fromEntries(new URL(route.request().url()).searchParams)
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(params).toEqual({ page: params.page, size: '100', sortBy: 'lastName', direction: 'ASC' })
    const number = Number(params.page)
    requested.push(number)
    if (number === 1) await pending.promise
    await fulfillJson(route, 200, pageData(number === 0 ? [otherAdmin, accountant] : [inactive, admin], number, 4, 2))
  })
  await page.goto('/settings/members?organizationId=999')
  await expect(page.getByRole('status', { name: 'Loading members' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('members-loading.png'), fullPage: true })
  pending.release()
  await expect(row(page, inactive.email).getByText('Inactive', { exact: true })).toBeVisible()
  expect(requested).toEqual([0, 1])
  await expect(page.getByText('1–4 of 4 members', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invite member', exact: true })).toBeDisabled()
  await expect(page.getByText(/yesterday|pending|suspended/i)).toHaveCount(0)
})

test('member settings searches every page, filters status and preserves URL navigation', async ({ page }) => {
  const many = Array.from({ length: 12 }, (_, index) => ({ ...accountant, id: index + 10, lastName: `Person ${String(index).padStart(2, '0')}`, email: `person${index}@example.com`, active: index !== 11 }))
  await mockList(page, (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'))
    return fulfillJson(route, 200, pageData(many.slice(number * 6, (number + 1) * 6), number, 12, 6))
  })
  await openMembers(page)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page).toHaveURL('/settings/members?page=2')
  await expect(row(page, many[5].email)).toBeVisible()
  await page.getByRole('combobox', { name: 'Filter by status' }).click()
  await page.getByRole('option', { name: 'Inactive', exact: true }).click()
  await expect(page).toHaveURL('/settings/members?status=inactive')
  await expect(row(page, many[11].email)).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL('/settings/members?page=2')
  await page.getByRole('textbox', { name: 'Search members' }).fill('emilie person11@example.com')
  await expect(page.getByRole('heading', { name: 'No matching members' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Search members' }).fill('person11@example.com')
  await expect(row(page, many[11].email)).toBeVisible()
  await expect(page.getByText('1–1 of 1 members', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Search members' }).fill('emilie')
  await expect(page.getByText('1–5 of 12 members', { exact: true })).toBeVisible()
})

for (const kind of ['empty', 'no match'] as const) {
  test(`member settings shows ${kind}`, async ({ page }, testInfo) => {
    if (kind === 'empty') await mockList(page, (route) => fulfillJson(route, 200, pageData([])))
    await page.goto(`/settings/members${kind === 'no match' ? '?q=unavailable&status=inactive' : ''}`)
    await expect(page.getByRole('heading', { name: kind === 'empty' ? 'No members yet' : 'No matching members' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('members-empty.png'), fullPage: true })
    if (kind === 'no match') {
      await page.getByRole('button', { name: 'Clear filters' }).click()
      await expect(page).toHaveURL('/settings/members')
      await expect(row(page, accountant.email)).toBeVisible()
    }
  })
}

for (const status of [403, 404, 500]) {
  test(`member settings handles list ${status} and retries`, async ({ page }, testInfo) => {
    let failed = true
    await mockList(page, (route) => fulfillJson(route, failed ? status : 200, failed ? { message: 'Unavailable' } : pageData()))
    await page.goto('/settings/members')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`members-error-${status}.png`), fullPage: true })
    failed = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(row(page, accountant.email)).toBeVisible()
  })
}

test('member settings discards an incomplete or changing team instead of exposing partial data', async ({ page }) => {
  await mockList(page, (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'))
    return fulfillJson(route, number === 0 ? 200 : 500, number === 0 ? pageData([admin], 0, 2, 1) : {})
  })
  await page.goto('/settings/members')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await mockList(page, (route) => fulfillJson(route, 200, pageData([admin, admin])))
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

for (const role of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`member settings denies ${role} without fetching members or roles`, async ({ page }, testInfo) => {
    let requests = 0
    await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code: role } })
    await mockList(page, async (route) => { requests++; await fulfillJson(route, 200, pageData()) })
    await mockApiRoute(page, '/v1/roles', async (route) => { requests++; await fulfillJson(route, 200, roles) })
    await page.goto('/settings/members')
    await expect(page.getByText('Member access denied', { exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Members', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /member/i })).toHaveCount(0)
    expect(requests).toBe(0)
    await page.screenshot({ path: testInfo.outputPath('members-denied.png'), fullPage: true })
  })
}

test('member settings protects the last active administrator but allows identity edits', async ({ page }) => {
  await mockList(page, (route) => fulfillJson(route, 200, pageData([admin, accountant, { ...otherAdmin, active: false }])))
  await openMembers(page, '?q=alex')
  await actions(page, admin).click()
  await expect(page.getByRole('menuitem', { name: 'Change role', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('menuitem', { name: 'Deactivate member', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText('The last active administrator must keep their role and access.', { exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Edit member', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('First name', { exact: true })).toBeFocused()
})

test('member settings validates identity and cancels without mutation', async ({ page }) => {
  let mutations = 0
  page.on('request', (request) => { if (request.method() === 'PATCH') mutations++ })
  await openMembers(page)
  const dialog = await openAction(page, 'Edit member')
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await dialog.getByLabel('First name', { exact: true }).fill(' ')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByLabel('First name', { exact: true })).toHaveAccessibleDescription('Enter a first name.')
  await dialog.getByLabel('First name', { exact: true }).fill(accountant.firstName)
  await dialog.getByLabel('Email', { exact: true }).fill('invalid@domain')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveAccessibleDescription('Enter a valid email address.')
  await expect(dialog.getByLabel('Email', { exact: true })).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(actions(page)).toBeFocused()
  expect(mutations).toBe(0)
})

test('member settings sends only changed identity fields once and waits for confirmation', async ({ page }, testInfo) => {
  const pending = deferred()
  let patches = 0
  await mockApiRoute(page, `/v1/users/${accountant.id}`, async (route) => {
    patches++
    expect(route.request().method()).toBe('PATCH')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().postDataJSON()).toEqual({ email: 'new@example.com' })
    await pending.promise
    await fulfillJson(route, 200, { ...accountant, email: 'new@example.com' })
  })
  await openMembers(page)
  const dialog = await openAction(page, 'Edit member')
  await dialog.getByLabel('First name', { exact: true }).fill(` ${accountant.firstName} `)
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await dialog.getByLabel('Email', { exact: true }).fill(' NEW@EXAMPLE.COM ')
  await dialog.getByRole('button', { name: 'Save changes' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(dialog.getByRole('form')).toHaveAttribute('aria-busy', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(page.getByText('Member updated.', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('members-saving.png'), fullPage: true })
  pending.release()
  await expect(dialog).toHaveCount(0)
  await expect(row(page, 'new@example.com')).toBeVisible()
  await expect(page.getByText('Member updated.', { exact: true })).toBeVisible()
  expect(patches).toBe(1)
  await page.screenshot({ path: testInfo.outputPath('members-success.png'), fullPage: true })
})

test('member settings keeps conflicting email editable and focuses its error', async ({ page }) => {
  let failed = true
  await mockApiRoute(page, `/v1/users/${accountant.id}`, (route) => fulfillJson(route, failed ? 409 : 200, failed ? { code: 'USER_EMAIL_CONFLICT' } : { ...accountant, email: 'available@example.com' }))
  await openMembers(page)
  const dialog = await openAction(page, 'Edit member')
  await dialog.getByLabel('Email', { exact: true }).fill('used@example.com')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByLabel('Email', { exact: true })).toBeFocused()
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveAccessibleDescription('This email address is already in use.')
  await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('used@example.com')
  failed = false
  await dialog.getByLabel('Email', { exact: true }).fill('available@example.com')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(row(page, 'available@example.com')).toBeVisible()
})

for (const action of ['edit', 'role', 'status'] as const) {
  for (const status of [400, 403, 404, 500]) {
    test(`member settings preserves data after ${action} ${status}`, async ({ page }) => {
      await mockApiRoute(page, `/v1/users/${accountant.id}${action === 'edit' ? '' : `/${action}`}`, (route) => fulfillJson(route, status, { message: 'Rejected' }))
      await openMembers(page)
      const dialog = await openAction(page, action === 'edit' ? 'Edit member' : action === 'role' ? 'Change role' : 'Deactivate member')
      if (action === 'edit') await dialog.getByLabel('First name', { exact: true }).fill('Changed')
      if (action === 'role') {
        await dialog.getByRole('combobox', { name: 'Role', exact: true }).click()
        await page.getByRole('option', { name: 'Accounting manager', exact: true }).click()
      }
      const submit = dialog.getByRole('button', { name: action === 'edit' ? 'Save changes' : action === 'role' ? 'Change role' : 'Deactivate member', exact: true })
      await submit.click()
      await expect(dialog.getByRole('alert')).toBeVisible()
      if ([403, 404].includes(status)) await expect(submit).toBeDisabled()
      else await expect(submit).toBeEnabled()
      if (action === 'edit') await expect(dialog.getByLabel('First name', { exact: true })).toHaveValue('Changed')
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(row(page, accountant.email).getByText(accountant.role.label, { exact: true })).toBeVisible()
      await expect(row(page, accountant.email).getByText('Active', { exact: true })).toBeVisible()
      await expect(page.getByText(/Member updated\.|Member role updated\.|Member deactivated\./)).toHaveCount(0)
    })
  }
}

test('member settings loads allowed roles with retry and waits for a confirmed role change', async ({ page }) => {
  const pendingRoles = deferred()
  const pendingSave = deferred()
  let failed = true
  await mockApiRoute(page, '/v1/roles', async (route) => {
    await pendingRoles.promise
    await fulfillJson(route, failed ? 500 : 200, failed ? {} : roles.map(({ code, label }) => ({ code, label })))
  })
  await mockApiRoute(page, `/v1/users/${accountant.id}/role`, async (route) => {
    expect(route.request().method()).toBe('PATCH')
    expect(route.request().postDataJSON()).toEqual({ roleCode: 'RESPONSABLE_COMPTABLE' })
    await pendingSave.promise
    await fulfillJson(route, 200, { ...accountant, role: roles[2] })
  })
  await openMembers(page)
  const dialog = await openAction(page, 'Change role')
  await expect(dialog.getByRole('status')).toHaveText('Loading roles…')
  await expect(dialog.getByRole('button', { name: 'Change role', exact: true })).toBeDisabled()
  pendingRoles.release()
  await expect(dialog.getByText('Unable to load available roles.')).toBeVisible()
  failed = false
  await dialog.getByRole('button', { name: 'Retry roles' }).click()
  await dialog.getByRole('combobox', { name: 'Role', exact: true }).click()
  await page.getByRole('option', { name: 'Accounting manager', exact: true }).click()
  await dialog.getByRole('button', { name: 'Change role', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(page.getByText('Member role updated.', { exact: true })).toHaveCount(0)
  pendingSave.release()
  await expect(row(page, accountant.email).getByText('Accounting manager', { exact: true })).toBeVisible()
})

test('member settings handles an empty role catalog', async ({ page }) => {
  await mockApiRoute(page, '/v1/roles', (route) => fulfillJson(route, 200, []))
  await openMembers(page)
  const dialog = await openAction(page, 'Change role')
  await expect(dialog.getByRole('status')).toHaveText('No roles are available. Contact an administrator.')
  await expect(dialog.getByRole('button', { name: 'Change role', exact: true })).toBeDisabled()
})

for (const member of [accountant, inactive]) {
  test(`member settings confirms ${member.active ? 'deactivation' : 'activation'} and keeps historical rows`, async ({ page }, testInfo) => {
    const pending = deferred()
    let patches = 0
    const label = member.active ? 'Deactivate member' : 'Activate member'
    await mockApiRoute(page, `/v1/users/${member.id}/status`, async (route) => {
      patches++
      expect(route.request().method()).toBe('PATCH')
      expect(route.request().postDataJSON()).toEqual({ active: !member.active })
      await pending.promise
      await fulfillJson(route, 200, { ...member, active: !member.active })
    })
    await openMembers(page)
    let dialog = await openAction(page, label, member)
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(patches).toBe(0)
    dialog = await openAction(page, label, member)
    await page.screenshot({ path: testInfo.outputPath('members-status-confirmation.png'), fullPage: true })
    await dialog.getByRole('button', { name: label, exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
    await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect(page.getByRole('row', { includeHidden: true }).filter({ hasText: member.email }).getByText(member.active ? 'Active' : 'Inactive', { exact: true })).toBeVisible()
    pending.release()
    await expect(dialog).toHaveCount(0)
    await expect(row(page, member.email).getByText(member.active ? 'Inactive' : 'Active', { exact: true })).toBeVisible()
    await expect(page.getByText('1–4 of 4 members', { exact: true })).toBeVisible()
    expect(patches).toBe(1)
  })
}

for (const action of ['role', 'status']) {
  test(`member settings respects a concurrent last administrator rejection for ${action}`, async ({ page }) => {
    await mockApiRoute(page, `/v1/users/${otherAdmin.id}/${action}`, (route) => fulfillJson(route, 409, { code: 'LAST_ACTIVE_ADMINISTRATOR' }))
    await openMembers(page)
    const dialog = await openAction(page, action === 'role' ? 'Change role' : 'Deactivate member', otherAdmin)
    if (action === 'role') {
      await dialog.getByRole('combobox', { name: 'Role', exact: true }).click()
      await page.getByRole('option', { name: 'Accounting operator', exact: true }).click()
    }
    const submit = dialog.getByRole('button', { name: action === 'role' ? 'Change role' : 'Deactivate member', exact: true })
    await submit.click()
    await expect(dialog.getByRole('alert')).toContainText('The last active administrator must keep their role and access.')
    await expect(submit).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(row(page, otherAdmin.email).getByText('Active', { exact: true })).toBeVisible()
  })
}

test('member settings handles the active user quota without activating the member', async ({ page }) => {
  await mockApiRoute(page, `/v1/users/${inactive.id}/status`, (route) => fulfillJson(route, 409, { code: 'SUBSCRIPTION_LIMIT_REACHED', limit: 'MAX_ACTIVE_USERS', quota: 3, usage: 3 }))
  await openMembers(page)
  const dialog = await openAction(page, 'Activate member', inactive)
  await dialog.getByRole('button', { name: 'Activate member', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('The active member limit for your plan has been reached.')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(row(page, inactive.email).getByText('Inactive', { exact: true })).toBeVisible()
})

test('member settings updates the current identity in the app shell', async ({ page }) => {
  await mockApiRoute(page, `/v1/users/${admin.id}`, (route) => fulfillJson(route, 200, { ...admin, firstName: 'Updated' }))
  await openMembers(page)
  const dialog = await openAction(page, 'Edit member', admin)
  await dialog.getByLabel('First name', { exact: true }).fill('Updated')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(actions(page, { ...admin, firstName: 'Updated' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^UM Updated Martin/ })).toBeVisible()
})

test('member settings removes administration immediately after changing its own role', async ({ page }) => {
  await mockApiRoute(page, `/v1/users/${admin.id}/role`, (route) => fulfillJson(route, 200, { ...admin, role: accountant.role }))
  await openMembers(page)
  const dialog = await openAction(page, 'Change role', admin)
  await expect(dialog.getByText('You are changing your own role. You will lose access to member administration.')).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Role', exact: true }).click()
  await page.getByRole('option', { name: 'Accounting operator', exact: true }).click()
  await dialog.getByRole('button', { name: 'Change role', exact: true }).click()
  await expect(page.getByText('Member access denied', { exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Members', exact: true })).toHaveCount(0)
})

for (const cause of ['self deactivation', 'expired session']) {
  test(`member settings signs out after ${cause}`, async ({ page }) => {
    await mockApiRoute(page, `/v1/users/${admin.id}/status`, (route) => fulfillJson(route, cause === 'expired session' ? 401 : 200, cause === 'expired session' ? {} : { ...admin, active: false }))
    await openMembers(page)
    const dialog = await openAction(page, 'Deactivate member', admin)
    await expect(dialog.getByText('You are deactivating your own account. You will be signed out.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Deactivate member', exact: true }).click()
    await expect(page).toHaveURL('/login')
    expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
  })
}

test('member settings ignores late mutations after leaving the page', async ({ page }) => {
  const pending = deferred()
  await mockApiRoute(page, `/v1/users/${accountant.id}`, async (route) => { await pending.promise; await fulfillJson(route, 200, { ...accountant, firstName: 'Late' }) })
  await openMembers(page)
  const dialog = await openAction(page, 'Edit member')
  await dialog.getByLabel('First name', { exact: true }).fill('Late')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeVisible()
  await page.evaluate(() => { history.pushState(null, '', '/integrations'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()
  pending.release()
  await expect(page.getByText('Member updated.', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('link', { name: 'Members', exact: true }).click()
  await expect(actions(page)).toBeVisible()
})

for (const width of [1440, 1280, 768, 390]) {
  test(`member settings is usable at ${width}px with keyboard and long values`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/settings')
    await page.getByRole('link', { name: 'Members', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(row(page, accountant.email)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`members-${width}.png`), fullPage: true })
    await actions(page).focus()
    await page.keyboard.press('Enter')
    await page.screenshot({ path: testInfo.outputPath(`members-actions-${width}.png`), fullPage: true })
    await page.getByRole('menuitem', { name: 'Edit member', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog').getByLabel('First name', { exact: true })).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath(`members-dialog-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(actions(page)).toBeFocused()
    if (width < 1024) {
      await page.getByRole('link', { name: 'All settings', exact: true }).click()
      await expect(page.getByRole('link', { name: 'Members', exact: true })).toBeVisible()
    }
    const longMember = { ...accountant, firstName: 'Anextraordinarilylongfirstnamewithoutspaces', lastName: 'Anextraordinarilylonglastnamewithoutspaces', email: 'averylongemailaddressforamember@averylongorganizationdomain.example.com', role: { ...accountant.role, label: 'Responsable comptable de l’organisation' } }
    const many = Array.from({ length: 50 }, (_, i) => ({ ...longMember, id: i + 10 }))
    await mockList(page, (route) => fulfillJson(route, 200, pageData(many)))
    await page.goto('/settings/members?page=5')
    await expect(page.getByRole('table', { name: 'Organization members' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`members-long-${width}.png`), fullPage: true })
  })
}

test('member settings handles network loss and list session expiry', async ({ page }) => {
  await mockList(page, (route) => route.abort())
  await page.goto('/settings/members')
  await expect(page.getByText('Unable to load members', { exact: true })).toBeVisible()
  await mockList(page, (route) => fulfillJson(route, 401, {}))
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page).toHaveURL('/login')
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
})

test('member settings clears the previous organization across sign out and sign in', async ({ page }) => {
  await openMembers(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  const otherUser = { ...currentUser, id: 20, organization: { id: 2, name: 'Beta', legalName: 'Beta SAS' } }
  await mockCurrentUser(page, otherUser)
  await mockApiRoute(page, '/v1/auth/login', (route) => fulfillJson(route, 200, { token: 'other-org-token' }))
  await mockApiRoute(page, '/v1/organizations/current/onboarding-status', (route) => fulfillJson(route, 200, { remainingActions: [] }))
  const pending = deferred()
  const betaMember = { ...admin, id: 20, email: 'beta@example.com' }
  await mockList(page, async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer other-org-token')
    await pending.promise
    await fulfillJson(route, 200, pageData([betaMember]))
  })
  await page.getByLabel('Work email').fill('beta@example.com')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('link', { name: 'Members', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Loading members' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  pending.release()
  await expect(row(page, betaMember.email)).toBeVisible()
  await expect(row(page, accountant.email)).toHaveCount(0)
})

test('member settings ignores a list response from a previous visit', async ({ page }) => {
  const pending = deferred()
  const oldResponse = deferred()
  let requests = 0
  await mockList(page, async (route) => {
    const old = ++requests === 1
    if (old) await pending.promise
    await fulfillJson(route, 200, pageData(old ? members : [admin]))
    if (old) oldResponse.release()
  })
  await page.goto('/settings/members')
  await expect(page.getByRole('status', { name: 'Loading members' })).toBeVisible()
  await page.getByRole('link', { name: 'General', exact: true }).click()
  await page.getByRole('link', { name: 'Members', exact: true }).click()
  await expect(row(page, admin.email)).toBeVisible()
  pending.release()
  await oldResponse.promise
  await expect(row(page, accountant.email)).toHaveCount(0)
  await expect(page.getByText('1–1 of 1 members', { exact: true })).toBeVisible()
})

test('member settings clamps an out of range page after a confirmed filtered status change', async ({ page }) => {
  await mockApiRoute(page, `/v1/users/${inactive.id}/status`, (route) => fulfillJson(route, 200, { ...inactive, active: true }))
  await openMembers(page, '?status=inactive&page=99')
  await expect(page.getByText('1–1 of 1 members', { exact: true })).toBeVisible()
  const dialog = await openAction(page, 'Activate member', inactive)
  await dialog.getByRole('button', { name: 'Activate member', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No matching members' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Search members' })).toBeFocused()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(row(page, inactive.email).getByText('Active', { exact: true })).toBeVisible()
})
