import { expect, test, type Page, type Route } from '@playwright/test'

import { AUTH_TOKEN_STORAGE_KEY, currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const endpoint = '/v1/organizations/current'
const accountingPath = '/settings/accounting'
const notificationPath = '/settings/notifications'
const organization = {
  organizationId: 1, name: 'Acme', legalName: 'Acme SAS', siret: '73282932000074',
  email: 'contact@acme.fr', phone: null, address: null, defaultCurrencyCode: 'EUR',
}
const references = { currencies: [{ code: 'EUR', label: 'Euro' }, { code: 'USD', label: 'US Dollar' }, { code: 'GBP', label: 'Pound sterling' }] }
const currencyField = (page: Page) => page.getByRole('combobox', { name: 'Currency', exact: true })
const form = (page: Page) => page.getByRole('form', { name: 'Accounting preferences' })
const success = (page: Page) => page.getByText('Currency saved and reloaded.', { exact: true })
const deferred = () => { let release = () => {}; const promise = new Promise<void>((resolve) => { release = resolve }); return { release, promise } }

async function screenshot(page: Page, path: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path, fullPage: true })
}

async function selectCurrency(page: Page, code = 'USD') {
  await currencyField(page).click()
  await page.getByPlaceholder('Search currencies…').fill(code)
  await page.getByRole('option', { name: new RegExp(`^${code} —`) }).click()
}
async function openAccounting(page: Page) {
  await page.goto(accountingPath)
  await expect(currencyField(page)).toHaveText('EUR — Euro')
}
async function mockOrganization(page: Page, handler: (route: Route) => Promise<void>) {
  await mockApiRoute(page, endpoint, async (route) => {
    expect(new URL(route.request().url()).pathname).toBe('/api/v1/organizations/current')
    expect(new URL(route.request().url()).search).toBe('')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    await handler(route)
  })
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockOrganization(page, (route) => fulfillJson(route, 200, organization))
  await mockApiRoute(page, '/v1/reference-data', (route) => fulfillJson(route, 200, references))
})

test('accounting preferences waits for the authenticated organization without defaulting to Figma values', async ({ page }, testInfo) => {
  const pending = deferred()
  await mockOrganization(page, async (route) => { expect(route.request().method()).toBe('GET'); await pending.promise; await fulfillJson(route, 200, organization) })
  await page.goto(`${accountingPath}?organizationId=999`)
  await expect(page.getByRole('status', { name: 'Loading accounting settings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  await screenshot(page, testInfo.outputPath('accounting-settings-loading.png'))
  pending.release()
  await expect(currencyField(page)).toHaveText('EUR — Euro')
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  const unavailable = form(page).getByRole('combobox').filter({ hasText: 'Not available' })
  await expect(unavailable).toHaveCount(9)
  for (const field of await unavailable.all()) await expect(field).toBeDisabled()
  await expect(form(page)).not.toContainText(/401000|445660|606300|1,260|January|ACH-|Docomptia standard/)
  await expect(form(page).getByRole('link', { name: 'Chart of accounts', exact: true })).toHaveAttribute('href', '/accounting/accounts')
  await expect(form(page).getByRole('link', { name: 'Accounting rules', exact: true })).toHaveAttribute('href', '/accounting/rules')
  await expect(form(page).getByRole('link', { name: 'Export center', exact: true })).toHaveAttribute('href', '/exports')
})

test('accounting preferences only confirms a currency after PATCH and a matching GET, then shares it with General', async ({ page }, testInfo) => {
  const patch = deferred()
  const reload = deferred()
  let saved = organization
  let writes = 0
  let reads = 0
  await mockOrganization(page, async (route) => {
    if (route.request().method() === 'PATCH') {
      writes++
      expect(route.request().postDataJSON()).toEqual({ defaultCurrencyCode: 'USD' })
      await patch.promise
      saved = { ...organization, defaultCurrencyCode: 'USD' }
    } else {
      expect(route.request().method()).toBe('GET')
      reads++
      if (reads === 2) await reload.promise
    }
    await fulfillJson(route, 200, saved)
  })
  await openAccounting(page)
  await selectCurrency(page)
  await page.getByRole('button', { name: 'Save changes' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(form(page)).toHaveAttribute('aria-busy', 'true')
  await expect(currencyField(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await expect(success(page)).toHaveCount(0)
  patch.release()
  await expect.poll(() => reads).toBe(2)
  await expect(success(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await screenshot(page, testInfo.outputPath('accounting-settings-saving.png'))
  reload.release()
  await expect(success(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await screenshot(page, testInfo.outputPath('accounting-settings-success.png'))
  await page.reload()
  await expect(currencyField(page)).toHaveText('USD — US Dollar')
  await page.goto('/settings/general')
  await expect(currencyField(page)).toHaveText('USD — US Dollar')
  expect(writes).toBe(1)
})

test('accounting preferences cancels a currency draft without writing', async ({ page }) => {
  let writes = 0
  page.on('request', (request) => { if (request.method() === 'PATCH') writes++ })
  await openAccounting(page)
  await selectCurrency(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(currencyField(page)).toHaveText('EUR — Euro')
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  expect(writes).toBe(0)
})

for (const value of [null, 'JPY']) {
  test(`accounting preferences preserves ${value === null ? 'an unset currency' : 'a currency absent from the catalogue'}`, async ({ page }, testInfo) => {
    await mockOrganization(page, (route) => fulfillJson(route, 200, { ...organization, defaultCurrencyCode: value }))
    await page.goto(accountingPath)
    await expect(currencyField(page)).toHaveText(value ?? 'Not configured')
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    if (value === null) await screenshot(page, testInfo.outputPath('accounting-settings-unset.png'))
  })
}

for (const status of [403, 404, 500]) {
  test(`accounting preferences handles GET ${status} and retries`, async ({ page }, testInfo) => {
    let failed = true
    await mockOrganization(page, (route) => fulfillJson(route, failed ? status : 200, failed ? {} : organization))
    await page.goto(accountingPath)
    await expect(page.getByRole('alert')).toContainText(status === 403 ? 'access denied' : 'Unable to load accounting settings')
    await expect(form(page)).toHaveCount(0)
    await screenshot(page, testInfo.outputPath(`accounting-settings-get-${status}.png`))
    failed = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(currencyField(page)).toHaveText('EUR — Euro')
  })
}

for (const [name, response] of [
  ['null', null], ['foreign organization', { ...organization, organizationId: 99 }],
  ['missing currency', { ...organization, defaultCurrencyCode: undefined }],
  ['invalid currency', { ...organization, defaultCurrencyCode: 123 }],
  ['array currency', { ...organization, defaultCurrencyCode: ['EUR'] }],
  ['invalid code', { ...organization, defaultCurrencyCode: 'EURO' }],
] as const) {
  test(`accounting preferences rejects ${name} from the organization API`, async ({ page }) => {
    await mockOrganization(page, (route) => fulfillJson(route, 200, response))
    await page.goto(accountingPath)
    await expect(page.getByRole('alert')).toContainText('Unable to load accounting settings')
    await expect(form(page)).toHaveCount(0)
  })
}

for (const [name, status, body] of [
  ['error', 500, {}], ['empty', 200, { currencies: [] }], ['invalid list', 200, { currencies: {} }],
  ['invalid item', 200, { currencies: [{ code: 'EUR', label: null }] }],
] as const) {
  test(`accounting preferences handles ${name} currency catalogue and retries`, async ({ page }) => {
    let failed = true
    await mockApiRoute(page, '/v1/reference-data', (route) => fulfillJson(route, failed ? status : 200, failed ? body : references))
    await page.goto(accountingPath)
    await expect(page.getByText('Currencies are unavailable. Retry to change the default currency.')).toBeVisible()
    await expect(currencyField(page)).toHaveText('EUR')
    await expect(currencyField(page)).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    failed = false
    await page.getByRole('button', { name: 'Retry currencies' }).click()
    await expect(currencyField(page)).toHaveText('EUR — Euro')
    await expect(currencyField(page)).toBeEnabled()
  })
}

for (const code of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`accounting preferences is read-only for ${code}`, async ({ page }, testInfo) => {
    await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code } })
    await openAccounting(page)
    await expect(page.getByText(/You have read-only access/)).toBeVisible()
    await expect(currencyField(page)).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
    await screenshot(page, testInfo.outputPath(`accounting-settings-${code}.png`))
  })
}

test('accounting preferences focuses server currency validation and retains the draft for correction', async ({ page }, testInfo) => {
  let failed = true
  let saved = organization
  await mockOrganization(page, async (route) => {
    if (route.request().method() === 'PATCH') {
      if (failed) return fulfillJson(route, 400, { code: 'ORGANIZATION_VALIDATION_ERROR', message: 'defaultCurrencyCode must be a recognized ISO 4217 code' })
      saved = { ...organization, defaultCurrencyCode: route.request().postDataJSON().defaultCurrencyCode }
    }
    await fulfillJson(route, 200, saved)
  })
  await openAccounting(page)
  await selectCurrency(page)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(currencyField(page)).toHaveAttribute('aria-invalid', 'true')
  await expect(currencyField(page)).toBeFocused()
  await expect(currencyField(page)).toHaveText('USD — US Dollar')
  await screenshot(page, testInfo.outputPath('accounting-settings-validation.png'))
  failed = false
  await selectCurrency(page, 'GBP')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(success(page)).toBeVisible()
  await expect(currencyField(page)).toHaveText('GBP — Pound sterling')
})

for (const failure of [403, 404, 409, 500, 501, 'network', 'invalid response'] as const) {
  test(`accounting preferences handles PATCH ${failure} without claiming success`, async ({ page }) => {
    await mockOrganization(page, (route) => {
      if (route.request().method() === 'GET') return fulfillJson(route, 200, organization)
      if (failure === 'network') return route.abort('failed')
      return fulfillJson(route, typeof failure === 'number' ? failure : 200, {})
    })
    await openAccounting(page)
    await selectCurrency(page)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(form(page).getByRole('alert')).toContainText(failure === 403 ? 'no longer have permission' : 'saved currency could not be confirmed')
    await expect(success(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await expect(currencyField(page)).toHaveText('USD — US Dollar')
    await page.getByRole('button', { name: 'Reload settings', exact: true }).click()
    await expect(currencyField(page)).toHaveText('EUR — Euro')
  })
}

for (const failure of [400, 500, 'mismatch', 'foreign organization'] as const) {
  test(`accounting preferences reconciles a committed currency after GET ${failure}`, async ({ page }) => {
    let reads = 0
    let saved = organization
    await mockOrganization(page, async (route) => {
      if (route.request().method() === 'PATCH') saved = { ...organization, defaultCurrencyCode: 'USD' }
      else if (++reads === 2) return fulfillJson(route, typeof failure === 'number' ? failure : 200,
        failure === 'mismatch' ? organization : { ...saved, organizationId: 999 })
      await fulfillJson(route, 200, saved)
    })
    await openAccounting(page)
    await selectCurrency(page)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(form(page).getByRole('alert')).toContainText('saved currency could not be confirmed')
    await expect(success(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await page.getByRole('button', { name: 'Reload settings', exact: true }).click()
    await expect(currencyField(page)).toHaveText('USD — US Dollar')
  })
}

for (const method of ['GET', 'PATCH']) {
  test(`accounting preferences signs out on ${method} session expiry`, async ({ page }) => {
    await mockOrganization(page, (route) => fulfillJson(route, route.request().method() === method ? 401 : 200, organization))
    if (method === 'GET') await page.goto(accountingPath)
    else {
      await openAccounting(page)
      await selectCurrency(page)
      await page.getByRole('button', { name: 'Save changes' }).click()
    }
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
  })
}

test('accounting preferences ignores a late reload from an earlier visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const pending = deferred()
  let reads = 0
  await mockOrganization(page, async (route) => {
    if (route.request().method() === 'PATCH') return fulfillJson(route, 200, { ...organization, defaultCurrencyCode: 'USD' })
    const stale = ++reads === 2
    if (stale) await pending.promise
    await fulfillJson(route, 200, stale ? { ...organization, defaultCurrencyCode: 'USD' } : organization)
  })
  await openAccounting(page)
  await selectCurrency(page)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => reads).toBe(2)
  const nav = page.getByRole('navigation', { name: 'Settings categories' })
  await nav.getByRole('link', { name: 'Notifications', exact: true }).click()
  await expect(page.getByText('Notification preferences unavailable', { exact: true })).toBeVisible()
  await nav.getByRole('link', { name: 'Accounting', exact: true }).click()
  await expect(currencyField(page)).toHaveText('EUR — Euro')
  pending.release()
  await expect(success(page)).toHaveCount(0)
  await expect(currencyField(page)).toHaveText('EUR — Euro')
})

for (const code of ['ADMIN', 'OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`notification preferences exposes unavailable channels without claiming a delivery state for ${code}`, async ({ page }) => {
    await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code } })
    const requests: string[] = []
    page.on('request', (request) => { if (request.resourceType() === 'fetch') requests.push(`${request.method()} ${new URL(request.url()).pathname}`) })
    await page.goto(notificationPath)
    await expect(page.getByText('Notification preferences unavailable', { exact: true })).toBeVisible()
    const channels = page.getByRole('button', { name: /preference unavailable$/ })
    await expect(channels).toHaveCount(18)
    for (const channel of await channels.all()) await expect(channel).toBeDisabled()
    await expect(page.getByRole('switch')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Save/ })).toHaveCount(0)
    await expect(page.getByText(/saved automatically/)).toHaveCount(0)
    expect(requests.every((request) => /^GET \/api\/v1\/(users\/me|notifications)$/.test(request))).toBe(true)
  })
}

test('notification preferences preserves access to the existing notification center', async ({ page }) => {
  await page.goto(notificationPath)
  await page.getByRole('button', { name: /^Notifications/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toBeVisible()
  await expect(page.getByText('No notifications yet', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Notification preferences unavailable', { exact: true })).toBeVisible()
})

for (const width of [1440, 768, 390]) {
  test(`accounting and notification settings follow Figma and support keyboard navigation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    await openAccounting(page)
    const year = await page.getByRole('combobox', { name: 'Fiscal year', exact: true }).boundingBox()
    const journal = await page.getByRole('combobox', { name: 'Default journal', exact: true }).boundingBox()
    if (width >= 768) expect(year!.y).toBe(journal!.y)
    else expect(journal!.y).toBeGreaterThan(year!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await screenshot(page, testInfo.outputPath(`accounting-settings-${width}.png`))
    await currencyField(page).focus()
    await page.keyboard.press('Enter')
    await page.getByPlaceholder('Search currencies…').fill('USD')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(currencyField(page)).toHaveText('USD — US Dollar')
    await expect(currencyField(page)).toBeFocused()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    if (width < 1024) await page.getByRole('link', { name: 'All settings', exact: true }).click()
    const nav = page.getByRole('navigation', { name: 'Settings categories' })
    await nav.getByRole('link', { name: 'Notifications', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(notificationPath)
    await expect(page.getByRole('heading', { name: 'Accounting & exports', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await screenshot(page, testInfo.outputPath(`notification-settings-${width}.png`))
  })
}
