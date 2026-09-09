import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Organization } from '../src/types/organization'
import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const endpoint = '/v1/organizations/current'
const organization: Organization = {
  organizationId: 1, name: 'Acme', legalName: 'Acme SAS', siret: '73282932000074',
  email: 'contact@acme.fr', phone: '0102030405', address: '12 rue de la Paix, 75002 Paris', defaultCurrencyCode: 'EUR',
}
const references = { currencies: [{ code: 'EUR', label: 'Euro' }, { code: 'USD', label: 'US Dollar' }] }

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, endpoint, (route) => fulfillJson(route, 200, organization))
  await mockApiRoute(page, '/v1/reference-data', (route) => fulfillJson(route, 200, references))
})

async function openSettings(page: Page) {
  await page.goto('/settings/general')
  await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Acme')
}

test('organization settings loads only the authenticated current organization and waits for its values', async ({ page }, testInfo) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, endpoint, async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(new URL(route.request().url()).search).toBe('')
    await pending
    await fulfillJson(route, 200, organization)
  })
  await page.goto('/settings/general?organizationId=999')
  await expect(page.getByRole('status', { name: 'Loading organization settings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('settings-loading.png'), fullPage: true })
  release()
  await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Acme')
  await expect(page.getByLabel('Legal name', { exact: true })).toHaveValue('Acme SAS')
  await expect(page.getByLabel('SIRET', { exact: true })).toHaveValue('732 829 320 00074')
  await expect(page.getByLabel('Contact email')).toHaveValue('contact@acme.fr')
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveText('EUR — Euro')
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Delete organization' })).toHaveCount(0)
  await expect(page.getByLabel('VAT number')).toHaveCount(0)
})

test('organization settings sends only normalized changes once and waits for server confirmation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  let saved = organization
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  let patches = 0
  await mockApiRoute(page, endpoint, async (route) => {
    if (route.request().method() === 'PATCH') {
      patches++
      expect(route.request().headers().authorization).toBe('Bearer e2e-token')
      expect(route.request().postDataJSON()).toEqual({ name: 'Acme Europe', email: 'office@acme.fr', phone: '', defaultCurrencyCode: 'USD' })
      await pending
      saved = { ...organization, name: 'Acme Europe', email: 'office@acme.fr', phone: null, defaultCurrencyCode: 'USD' }
    }
    await fulfillJson(route, 200, saved)
  })
  await openSettings(page)
  await page.getByLabel('Organization name', { exact: true }).fill(' Acme Europe ')
  await page.getByLabel('Contact email').fill(' OFFICE@ACME.FR ')
  await page.getByLabel('Phone', { exact: true }).fill('  ')
  await page.getByRole('combobox', { name: 'Currency', exact: true }).click()
  await page.getByPlaceholder('Search currencies…').fill('USD')
  await page.getByRole('option', { name: 'USD — US Dollar' }).click()
  await page.getByRole('button', { name: 'Save changes' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(page.getByRole('form')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(page.getByLabel('Organization name', { exact: true })).toBeDisabled()
  await expect(page.getByText('Changes saved.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Acme Europe', { exact: true })).toHaveCount(0)
  release()
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible()
  await expect(page.getByText('Acme Europe', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Acme Europe')
  await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('settings-success.png'), fullPage: true })
  await page.reload()
  await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Acme Europe')
  expect(patches).toBe(1)
})

test('organization settings cancels edits and does not submit unchanged normalized values', async ({ page }) => {
  let patches = 0
  page.on('request', (request) => { if (request.method() === 'PATCH') patches++ })
  await openSettings(page)
  await page.getByLabel('Organization name', { exact: true }).fill(' Acme ')
  await page.getByLabel('SIRET', { exact: true }).fill(organization.siret)
  await page.getByLabel('Contact email').fill('CONTACT@ACME.FR')
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await page.getByLabel('Address', { exact: true }).fill('New address')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Address', { exact: true })).toHaveValue(organization.address!)
  await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Acme')
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  expect(patches).toBe(0)
})

for (const [label, value, message] of [
  ['Organization name', '  ', 'Enter the organization name.'],
  ['Legal name', '', 'Enter the legal name.'],
  ['SIRET', '73282932000074X', 'Enter a valid 14-digit French SIRET.'],
  ['Contact email', 'invalid', 'Enter a valid contact email.'],
]) {
  test(`organization settings validates ${label} before submission and focuses its error`, async ({ page }) => {
    let patches = 0
    page.on('request', (request) => { if (request.method() === 'PATCH') patches++ })
    await openSettings(page)
    const field = page.getByLabel(label, { exact: true })
    await field.fill(value)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(field).toBeFocused()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(message)
    expect(patches).toBe(0)
  })
}

for (const [status, code, message, description] of [
  [400, 'ORGANIZATION_VALIDATION_ERROR', 'siret must be a valid French SIRET', 'Enter a valid 14-digit French SIRET.'],
  [409, 'ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT', 'SIRET conflict', 'Another organization already uses this SIRET.'],
] as const) {
  test(`organization settings maps the legal ${status} error to SIRET and allows correction`, async ({ page }, testInfo) => {
    let fail = true
    await mockApiRoute(page, endpoint, async (route) => {
      if (route.request().method() === 'PATCH' && fail) await fulfillJson(route, status, { code, message })
      else await fulfillJson(route, 200, organization)
    })
    await openSettings(page)
    const siret = page.getByLabel('SIRET', { exact: true })
    await siret.fill('12345678901234')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(siret).toBeFocused()
    await expect(siret).toHaveAccessibleDescription(description)
    await expect(siret).toHaveValue('12345678901234')
    await expect(page.getByText('Changes saved.', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`settings-siret-${status}.png`), fullPage: true })
    fail = false
    await siret.fill(organization.siret)
    await page.getByLabel('Address', { exact: true }).fill('Updated address')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible()
    // The confirmed response remains authoritative, including unchanged server values.
    await expect(page.getByLabel('Address', { exact: true })).toHaveValue(organization.address!)
  })
}

test('organization settings associates server currency validation with the searchable control', async ({ page }) => {
  await mockApiRoute(page, endpoint, (route) => route.request().method() === 'PATCH'
    ? fulfillJson(route, 400, { code: 'ORGANIZATION_VALIDATION_ERROR', message: 'defaultCurrencyCode must be a recognized ISO 4217 code' })
    : fulfillJson(route, 200, organization))
  await openSettings(page)
  const currency = page.getByRole('combobox', { name: 'Currency', exact: true })
  await currency.focus()
  await page.keyboard.press('Enter')
  await page.getByPlaceholder('Search currencies…').fill('USD')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(currency).toHaveText('USD — US Dollar')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(currency).toBeFocused()
  await expect(currency).toHaveAttribute('aria-invalid', 'true')
  await expect(currency).toHaveAccessibleDescription('defaultCurrencyCode must be a recognized ISO 4217 code')
})

for (const status of [403, 404, 500]) {
  test(`organization settings shows a GET ${status} error and retries without a blank editable form`, async ({ page }, testInfo) => {
    let fail = true
    await mockApiRoute(page, endpoint, (route) => fulfillJson(route, fail ? status : 200, fail ? { message: 'Unavailable' } : organization))
    await page.goto('/settings/general')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('form')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`settings-load-${status}.png`), fullPage: true })
    fail = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Acme')
  })
}

for (const data of [null, { ...organization, organizationId: 999, name: 'Other organization' }]) {
  test(`organization settings rejects ${data ? 'another organization' : 'an empty response'}`, async ({ page }) => {
    await mockApiRoute(page, endpoint, (route) => fulfillJson(route, 200, data))
    await page.goto('/settings/general')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('form')).toHaveCount(0)
    await expect(page.getByText('Other organization', { exact: true })).toHaveCount(0)
  })
}

for (const status of [403, 500, 501]) {
  test(`organization settings preserves edits after PATCH ${status} and reloads confirmed values`, async ({ page }) => {
    await mockApiRoute(page, endpoint, (route) => route.request().method() === 'PATCH'
      ? fulfillJson(route, status, { message: 'Save failed' }) : fulfillJson(route, 200, organization))
    await openSettings(page)
    await page.getByLabel('Organization name', { exact: true }).fill('Pending change')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Pending change')
    await expect(page.getByText('Changes saved.', { exact: true })).toHaveCount(0)
    if (status === 403) await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await page.getByRole('button', { name: 'Reload settings' }).click()
    await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Acme')
  })
}

for (const role of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  test(`organization settings allows ${role} to consult but not update`, async ({ page }, testInfo) => {
    await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code: role } })
    await openSettings(page)
    await expect(page.getByText('Only administrators can update these settings. You have read-only access.')).toBeVisible()
    for (const label of ['Organization name', 'Legal name', 'SIRET', 'Contact email', 'Phone', 'Address']) {
      await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('readonly', '')
    }
    await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`settings-${role}.png`), fullPage: true })
  })
}

for (const mode of ['error', 'empty'] as const) {
  test(`organization settings keeps identity editing available with ${mode} currencies and supports retry`, async ({ page }) => {
    let fail = true
    await mockApiRoute(page, '/v1/reference-data', (route) => fulfillJson(route, fail && mode === 'error' ? 500 : 200, fail ? { currencies: [] } : references))
    await openSettings(page)
    await expect(page.getByText('Currencies are unavailable. You can still update your organization information.')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveText('EUR')
    await page.getByLabel('Phone', { exact: true }).fill('0607080910')
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    fail = false
    await page.getByRole('button', { name: 'Retry currencies' }).click()
    await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveText('EUR — Euro')
    await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('0607080910')
  })
}

test('organization settings preserves an unset currency and clears optional contact data explicitly', async ({ page }) => {
  const initial = { ...organization, defaultCurrencyCode: null, phone: null }
  await mockApiRoute(page, endpoint, async (route) => {
    if (route.request().method() === 'PATCH') expect(route.request().postDataJSON()).toEqual({ address: '' })
    await fulfillJson(route, 200, route.request().method() === 'PATCH' ? { ...initial, address: null } : initial)
  })
  await openSettings(page)
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveText('Not configured')
  await page.getByLabel('Address', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveText('Not configured')
  await expect(page.getByLabel('Address', { exact: true })).toHaveValue('')
})

test('organization settings handles session expiry during save', async ({ page }) => {
  await mockApiRoute(page, endpoint, (route) => route.request().method() === 'PATCH'
    ? fulfillJson(route, 401, { message: 'Session expired' }) : fulfillJson(route, 200, organization))
  await openSettings(page)
  await page.getByLabel('Organization name', { exact: true }).fill('Pending change')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.getByText('Changes saved.', { exact: true })).toHaveCount(0)
})

test('organization settings ignores a late save after navigation', async ({ page }) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, endpoint, async (route) => {
    if (route.request().method() === 'PATCH') await pending
    await fulfillJson(route, 200, { ...organization, name: route.request().method() === 'PATCH' ? 'Late change' : 'Acme' })
  })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openSettings(page)
  await page.getByLabel('Organization name', { exact: true }).fill('Late change')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible()
  await page.getByRole('link', { name: 'Integrations', exact: true }).click()
  release()
  await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()
  await expect(page.getByText('Late change', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue('Acme')
})

for (const width of [1440, 768, 390]) {
  test(`organization settings follows the Figma layout at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/settings')
    if (width < 1024) {
      await expect(page.getByRole('form')).not.toBeVisible()
      await page.getByRole('link', { name: 'General', exact: true }).focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL('/settings/general')
    }
    await expect(page.getByLabel('Organization name', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveText('EUR — Euro')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const name = await page.getByLabel('Organization name', { exact: true }).boundingBox()
    const legal = await page.getByLabel('Legal name', { exact: true }).boundingBox()
    if (width >= 768) expect(name!.y).toBe(legal!.y)
    else expect(legal!.y).toBeGreaterThan(name!.y + name!.height)
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`), fullPage: true })
    if (width < 1024) {
      await page.getByRole('link', { name: 'All settings', exact: true }).click()
      await expect(page).toHaveURL('/settings')
      await expect(page.getByRole('link', { name: 'General', exact: true })).toBeVisible()
    }
  })
}
