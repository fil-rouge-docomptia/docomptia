import { expect, test, type Page, type Route } from '@playwright/test'
import { AUTH_TOKEN_STORAGE_KEY, currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const auditPath = '/settings/audit-logs'
const securityPath = '/settings/security'
const endpoint = '/v1/audit-logs**'
const auditEvent = {
  id: 12, organizationId: 1, occurredAt: '2026-09-09T10:00:00', actor: { id: 1, name: 'Alex Martin' },
  action: 'ROLE_CHANGED', resource: 'User', resourceId: 2,
  change: { field: 'role', previousValue: 'ADMIN', newValue: 'OPERATEUR_COMPTABLE' },
}
const member = { ...currentUser, active: true }
const auditPage = (content: unknown[] = [auditEvent], number = 0, totalElements = content.length) => ({ content, number, size: 25, totalElements, totalPages: Math.ceil(totalElements / 25) })
const deferred = () => { let release = () => {}; const promise = new Promise<void>((resolve) => { release = resolve }); return { release, promise } }
async function capture(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `test-results/audit-security-${name}.png`, fullPage: true })
}
async function mockAudit(page: Page, handler: (route: Route) => Promise<void>) {
  await mockApiRoute(page, endpoint, async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().postData()).toBeNull()
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    const url = new URL(route.request().url())
    expect(url.searchParams.has('organizationId')).toBe(false)
    await handler(route)
  })
}
test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/users?*', (route) => fulfillJson(route, 200, { content: [member], number: 0, size: 100, totalElements: 1, totalPages: 1 }))
  await mockAudit(page, (route) => fulfillJson(route, 200, /\/audit-logs\/\d+$/.test(new URL(route.request().url()).pathname) ? auditEvent : auditPage()))
})

test('audit waits for the API and exposes a read-only list without mutation actions', async ({ page }) => {
  const gate = deferred()
  await mockAudit(page, async (route) => {
    expect(new URL(route.request().url()).search).toBe('?page=0&size=25')
    await gate.promise
    await fulfillJson(route, 200, auditPage())
  })
  await page.goto(`${auditPath}?organizationId=999`)
  await expect(page.getByRole('status', { name: 'Loading audit logs' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Audit events' })).toHaveCount(0)
  await capture(page, 'loading')
  gate.release()
  await expect(page.getByRole('table', { name: 'Audit events' })).toBeVisible()
  await expect(page.getByText('Changed member role', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /delete|edit|export|save/i })).toHaveCount(0)
  await expect(page.getByText('1–1 of 1 events')).toBeVisible()
})

test('audit expands real details only after their response and supports keyboard collapse', async ({ page }) => {
  const gate = deferred()
  await mockApiRoute(page, '/v1/audit-logs/12', async (route) => { await gate.promise; await fulfillJson(route, 200, auditEvent) })
  await page.goto(auditPath)
  const trigger = page.getByRole('button', { name: 'View event 12' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status', { name: 'Loading event details' })).toBeVisible()
  await expect(page.getByText('Previous role', { exact: true })).toHaveCount(0)
  gate.release()
  await expect(page.getByText('Previous role', { exact: true })).toBeVisible()
  await capture(page, 'expanded')
  await page.getByRole('button', { name: 'Hide event 12' }).press('Enter')
  await expect(page.getByRole('region', { name: 'Event 12 details' })).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

for (const status of [400, 403, 404, 500, 501]) test(`audit list handles ${status} and can retry`, async ({ page }) => {
  let fail = true
  await mockAudit(page, (route) => fulfillJson(route, fail ? status : 200, fail ? { message: 'PRIVATE_SERVER_DETAIL' } : auditPage()))
  await page.goto(auditPath)
  await expect(page.getByRole('button', { name: 'Retry logs' })).toBeVisible()
  await expect(page.getByText('PRIVATE_SERVER_DETAIL')).toHaveCount(0)
  await capture(page, `list-${status}`)
  fail = false
  await page.getByRole('button', { name: 'Retry logs' }).click()
  await expect(page.getByRole('button', { name: 'View event 12' })).toBeVisible()
})

for (const status of [403, 404, 500]) test(`audit detail handles ${status} without showing cached values`, async ({ page }) => {
  let fail = true
  await mockApiRoute(page, '/v1/audit-logs/12', (route) => fulfillJson(route, fail ? status : 200, fail ? { message: 'PRIVATE_ERROR' } : auditEvent))
  await page.goto(auditPath)
  await page.getByRole('button', { name: 'View event 12' }).click()
  await expect(page.getByText('Event details unavailable', { exact: true })).toBeVisible()
  await expect(page.getByText('Previous role', { exact: true })).toHaveCount(0)
  await expect(page.getByText('PRIVATE_ERROR')).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Retry event' }).click()
  await expect(page.getByText('Previous role', { exact: true })).toBeVisible()
})

for (const target of ['list', 'detail']) test(`audit ${target} expires the session on 401`, async ({ page }) => {
  await mockApiRoute(page, target === 'list' ? endpoint : '/v1/audit-logs/12', (route) => fulfillJson(route, 401, {}))
  await page.goto(auditPath)
  if (target === 'detail') await page.getByRole('button', { name: 'View event 12' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
})

for (const [name, payload] of [
  ['foreign organization', auditPage([{ ...auditEvent, organizationId: 2 }])],
  ['missing content', {}], ['wrong page', auditPage([auditEvent], 3)],
  ['wrong count', auditPage([auditEvent], 0, 50)],
  ['invalid timestamp', auditPage([{ ...auditEvent, occurredAt: 'PRIVATE_DATA' }])],
  ['invalid actor', auditPage([{ ...auditEvent, actor: 'PRIVATE_DATA' }])],
  ['duplicate events', auditPage([auditEvent, auditEvent])],
] as const) test(`audit rejects ${name}`, async ({ page }) => {
  await mockAudit(page, (route) => fulfillJson(route, 200, payload))
  await page.goto(auditPath)
  await expect(page.getByText('Unable to load audit logs', { exact: true })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Audit events' })).toHaveCount(0)
  await expect(page.getByText('PRIVATE_DATA')).toHaveCount(0)
})

test('audit ignores secret fields and unknown action/resource strings in list and detail', async ({ page }) => {
  const event = { ...auditEvent, action: 'PRIVATE_ACTION', resource: 'PRIVATE_RESOURCE', change: null, oldValue: 'PRIVATE_PASSWORD', newValue: 'PRIVATE_INVOICE', token: 'PRIVATE_TOKEN', metadata: { document: 'PRIVATE_DOCUMENT' } }
  await mockAudit(page, (route) => fulfillJson(route, 200, new URL(route.request().url()).pathname.endsWith('/12') ? event : auditPage([event])))
  await page.goto(auditPath)
  await expect(page.getByText('Other event', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View event 12' }).click()
  await expect(page.getByText('Detailed values are not available in this audit view.')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PRIVATE_')
  await expect(page.getByText('Other resource #2')).toHaveCount(0)
})

test('audit renders only recognized role/status changes and leaves missing data explicit', async ({ page }) => {
  const events = [
    { ...auditEvent, change: { field: 'role', previousValue: 'ADMIN', newValue: 'PRIVATE_SECRET' } },
    { ...auditEvent, id: 13, action: 'STATUS_CHANGED', occurredAt: null, actor: null, change: { field: 'active', previousValue: 'true', newValue: 'false' } },
  ]
  await mockAudit(page, (route) => fulfillJson(route, 200, auditPage(events)))
  await page.goto(auditPath)
  await expect(page.getByText('Date unavailable')).toBeVisible()
  await expect(page.getByText('User unavailable', { exact: true })).toBeVisible()
  await expect(page.getByText('Active → Inactive')).toBeVisible()
  await expect(page.getByText('System', { exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('PRIVATE_SECRET')
})

for (const payload of [{ ...auditEvent, id: 13 }, { ...auditEvent, organizationId: 2 }, null]) test(`audit rejects mismatched detail ${JSON.stringify(payload?.id ?? null)}-${payload?.organizationId ?? 0}`, async ({ page }) => {
  await mockApiRoute(page, '/v1/audit-logs/12', (route) => fulfillJson(route, 200, payload))
  await page.goto(auditPath)
  await page.getByRole('button', { name: 'View event 12' }).click()
  await expect(page.getByText('Event details unavailable', { exact: true })).toBeVisible()
})

test('audit filters the API, resets pagination and restores filters through browser history', async ({ page }) => {
  const queries: URLSearchParams[] = []
  await mockAudit(page, (route) => { const q = new URL(route.request().url()).searchParams; queries.push(q); return fulfillJson(route, 200, auditPage()) })
  await page.goto(auditPath)
  await page.getByRole('combobox', { name: 'Filter by user' }).click()
  await page.getByPlaceholder('Search users…').fill('Alex')
  await page.getByRole('option', { name: 'Alex Martin', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('userId')).toBe('1')
  await page.getByRole('combobox', { name: 'Filter by action' }).click()
  await page.getByRole('option', { name: 'Changed member role', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('action')).toBe('ROLE_CHANGED')
  await page.getByRole('combobox', { name: 'Filter by resource' }).click()
  await page.getByRole('option', { name: 'Member', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('resource')).toBe('User')
  await page.getByRole('button', { name: 'Filter by date' }).click()
  await page.getByLabel('From', { exact: true }).fill('2026-09-01')
  await page.getByLabel('To', { exact: true }).fill('2026-09-09')
  await page.keyboard.press('Escape')
  await expect.poll(() => queries.at(-1)?.get('to')).toBe('2026-09-09')
  expect(queries.at(-1)?.get('from')).toBe('2026-09-01')
  expect(queries.at(-1)?.get('page')).toBe('0')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect.poll(() => queries.at(-1)?.get('userId')).toBeNull()
  await page.goBack()
  await expect.poll(() => queries.at(-1)?.get('userId')).toBe('1')
  await expect(page.getByRole('button', { name: 'Filter by date' })).toHaveText('Date range applied')
})

test('audit changes pages while waiting for fresh results and can return from a stale page', async ({ page }) => {
  const events = Array.from({ length: 26 }, (_, i) => ({ ...auditEvent, id: i + 1 }))
  const gate = deferred()
  await mockAudit(page, async (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'))
    if (number === 1) await gate.promise
    await fulfillJson(route, 200, number === 1 ? auditPage([], 1, 0) : auditPage(events.slice(0, 25), 0, 26))
  })
  await page.goto(auditPath)
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('status', { name: 'Loading audit logs' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View event 1', exact: true })).toHaveCount(0)
  gate.release()
  await expect(page.getByText('No events on this page')).toBeVisible()
  await page.getByRole('button', { name: 'First page' }).click()
  await expect(page.getByText('1–25 of 26 events')).toBeVisible()
})

for (const query of ['page=-1', 'page=abc', 'page=9999999999999999', 'userId=-3', 'action=PRIVATE', 'resource=constructor', 'from=2026-02-30', 'from=2026-09-10&to=2026-09-09']) test(`audit rejects invalid URL filters ${query}`, async ({ page }) => {
  let requests = 0
  await mockAudit(page, (route) => { requests++; return fulfillJson(route, 200, auditPage()) })
  await page.goto(`${auditPath}?${query}`)
  await expect(page.getByText('Invalid audit filters', { exact: true })).toBeVisible()
  expect(requests).toBe(0)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByRole('button', { name: 'View event 12' })).toBeVisible()
})

for (const filtered of [false, true]) test(`audit differentiates empty data from ${filtered ? 'filtered' : 'initial'} results`, async ({ page }) => {
  await mockAudit(page, (route) => fulfillJson(route, 200, auditPage([])))
  await page.goto(`${auditPath}${filtered ? '?action=ROLE_CHANGED' : ''}`)
  await expect(page.getByText(filtered ? 'No matching events' : 'No audit events yet', { exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Audit pagination' })).toHaveCount(0)
  await capture(page, filtered ? 'filtered-empty' : 'empty')
})

test('audit user catalogue failures do not hide the log and can retry independently', async ({ page }) => {
  let fail = true
  await mockApiRoute(page, '/v1/users?*', (route) => fulfillJson(route, fail ? 500 : 200, fail ? {} : { content: [member], number: 0, size: 100, totalElements: 1, totalPages: 1 }))
  await page.goto(auditPath)
  await expect(page.getByRole('button', { name: 'View event 12' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Filter by user' })).toBeDisabled()
  fail = false
  await page.getByRole('button', { name: 'Retry user filter' }).click()
  await expect(page.getByRole('combobox', { name: 'Filter by user' })).toBeEnabled()
})

for (const role of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) test(`audit denies ${role}, security remains available`, async ({ page }) => {
  await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code: role } })
  let calls = 0
  await mockAudit(page, (route) => { calls++; return fulfillJson(route, 200, auditPage()) })
  await page.goto(auditPath)
  await expect(page.getByText('Audit access denied', { exact: true })).toBeVisible()
  expect(calls).toBe(0)
  await expect(page.getByRole('link', { name: 'Audit logs', exact: true })).toHaveCount(0)
  await page.goto(securityPath)
  await expect(page.getByRole('button', { name: 'Sign out here' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View audit logs' })).toHaveCount(0)
})

test('security shows unavailable capabilities without invented devices, secrets or successful actions', async ({ page }) => {
  const unexpected: string[] = []
  page.on('request', (request) => { if (/\/api\/.*(security|sessions|password|2fa)/i.test(request.url())) unexpected.push(request.url()) })
  await page.goto(securityPath)
  for (const name of ['Change password', 'Set up 2FA', 'Sign out others']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('e2e-token')
  await expect(page.locator('body')).not.toContainText('Encrypted in transit')
  await expect(page.locator('body')).not.toContainText('Paris, France')
  await expect(page.getByText('Not enabled', { exact: true })).toHaveCount(0)
  expect(unexpected).toEqual([])
})

test('security confirms local sign-out, initially focuses Cancel and preserves the connection on cancel', async ({ page }) => {
  await page.goto(securityPath)
  const trigger = page.getByRole('button', { name: 'Sign out here' })
  await trigger.click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await expect(dialog).toContainText('It does not sign out other devices or revoke access on the server.')
  await capture(page, 'signout-dialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(trigger).toBeFocused()
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBe('e2e-token')
  await trigger.press('Enter')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out of this browser', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
})

for (const width of [1440, 768, 390]) test(`audit and security are usable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  for (const [path, name] of [[auditPath, 'audit'], [securityPath, 'security']]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: name === 'audit' ? 'Audit logs' : 'Security', exact: true })).toBeVisible()
    if (name === 'audit') await expect(page.getByRole('button', { name: 'View event 12' })).toBeVisible()
    await capture(page, `${name}-${width}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (name === 'security') {
      await page.getByRole('button', { name: 'Sign out here' }).click()
      const box = await page.getByRole('alertdialog').boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
    }
  }
  await page.goto('/settings')
  await page.getByRole('link', { name: 'Security', exact: true }).press('Enter')
  await expect(page).toHaveURL(new RegExp(`${securityPath}$`))
  if (width < 1024) await page.getByRole('link', { name: 'All settings' }).click()
  await page.getByRole('link', { name: 'Audit logs', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${auditPath}$`))
})

test('audit ignores an older list response after changing filters', async ({ page }) => {
  const gate = deferred()
  let started = false
  await mockAudit(page, async (route) => {
    if (!new URL(route.request().url()).searchParams.has('action')) {
      started = true
      await gate.promise
      await fulfillJson(route, 200, auditPage())
    } else await fulfillJson(route, 200, auditPage([]))
  })
  await page.goto(auditPath)
  await expect.poll(() => started).toBe(true)
  await page.getByRole('combobox', { name: 'Filter by action' }).click()
  await page.getByRole('option', { name: 'Changed member status', exact: true }).click()
  await expect(page.getByText('No matching events', { exact: true })).toBeVisible()
  gate.release()
  await expect(page.getByRole('button', { name: 'View event 12' })).toHaveCount(0)
  await expect(page.getByText('No matching events', { exact: true })).toBeVisible()
})

test('audit late detail does not reopen a collapsed event', async ({ page }) => {
  const gate = deferred()
  let started = false
  await mockApiRoute(page, '/v1/audit-logs/12', async (route) => { started = true; await gate.promise; await fulfillJson(route, 200, auditEvent) })
  await page.goto(auditPath)
  await page.getByRole('button', { name: 'View event 12' }).click()
  await expect.poll(() => started).toBe(true)
  await page.getByRole('button', { name: 'Hide event 12' }).click()
  gate.release()
  await expect(page.getByRole('region', { name: 'Event 12 details' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'View event 12' })).toBeFocused()
})

test('audit paginates normally and returns to page one when filtering', async ({ page }) => {
  const events = Array.from({ length: 26 }, (_, i) => ({ ...auditEvent, id: i + 1 }))
  const queries: URLSearchParams[] = []
  await mockAudit(page, (route) => {
    const q = new URL(route.request().url()).searchParams
    queries.push(q)
    const number = Number(q.get('page'))
    return fulfillJson(route, 200, auditPage(events.slice(number * 25, (number + 1) * 25), number, 26))
  })
  await page.goto(`${auditPath}?page=2`)
  await expect(page.getByText('26–26 of 26 events')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Filter by action' }).click()
  await page.getByRole('option', { name: 'Changed member role', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('page')).toBe('0')
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.getByText('1–25 of 26 events')).toBeVisible()
})

test('audit network errors can be retried without exposing their details', async ({ page }) => {
  let fail = true
  await mockAudit(page, (route) => fail ? route.abort('failed') : fulfillJson(route, 200, auditPage()))
  await page.goto(auditPath)
  await expect(page.getByText('Unable to load audit logs', { exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry logs' }).click()
  await expect(page.getByRole('button', { name: 'View event 12' })).toBeVisible()
})
