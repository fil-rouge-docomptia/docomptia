import { expect, test, type Page } from '@playwright/test'
import { AUTH_TOKEN_STORAGE_KEY, currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const profilePath = '/profile'
const billingPath = '/settings/billing'
const subscriptionEndpoint = '/v1/organizations/current/subscription'
const plansEndpoint = '/v1/subscription-plans'
const plan = { code: 'BUSINESS', name: 'Business', maxActiveUsers: 10, monthlyInvoiceLimit: 1000, features: ['OCR', 'AUDIT_LOG'] }
const starter = { code: 'STARTER', name: 'Starter', maxActiveUsers: 2, monthlyInvoiceLimit: 100, features: ['OCR'] }
const pro = { code: 'PRO', name: 'Pro', maxActiveUsers: null, monthlyInvoiceLimit: null, features: ['API_ACCESS'] }
const subscription = { subscribed: true, status: 'ACTIVE', nextBillingDate: '2026-10-01', plan, usage: { periodStart: '2026-09-01', periodEnd: '2026-09-30', activeUsers: 8, monthlyInvoices: 684 } }
const noSubscription = { subscribed: false, status: null, nextBillingDate: null, plan: null, usage: null }
const deferred = () => { let release = () => {}; const promise = new Promise<void>((resolve) => { release = resolve }); return { promise, release } }
const capture = (page: Page, name: string) => page.screenshot({ path: `test-results/profile-billing-${name}.png`, fullPage: true })

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, plansEndpoint, (route) => fulfillJson(route, 200, [starter, plan, pro]))
  await mockApiRoute(page, subscriptionEndpoint, (route) => fulfillJson(route, 200, subscription))
})

test('billing uses authenticated current-organization APIs and real quotas, without invented payments', async ({ page }) => {
  const requests: string[] = []
  for (const endpoint of [subscriptionEndpoint, plansEndpoint]) await mockApiRoute(page, endpoint, async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().postData()).toBeNull()
    expect(new URL(route.request().url()).search).toBe('')
    requests.push(endpoint)
    await fulfillJson(route, 200, endpoint === plansEndpoint ? [starter, plan, pro] : subscription)
  })
  await page.goto(`${billingPath}?organizationId=999`)
  await expect(page.getByRole('region', { name: 'Subscription', exact: true })).toContainText('Business')
  await expect(page.getByRole('region', { name: 'Usage', exact: true })).toContainText('684 / 1,000')
  await expect(page.getByRole('region', { name: 'Usage', exact: true })).toContainText('8 / 10')
  await expect(page.getByRole('progressbar', { name: 'Invoices usage' })).toHaveAttribute('aria-valuetext', '684 of 1000')
  await expect(page.getByRole('article', { name: 'Pro plan' })).toContainText('Unlimited active users')
  await expect(page.getByRole('article', { name: 'Business plan' }).getByText('Current plan', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('1 Oct 2026', { exact: true })).toBeVisible()
  await expect(page.getByText('Billing history unavailable', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('€')
  await expect(page.getByText('Paid', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /download/i })).toHaveCount(0)
  for (const name of ['Choose Starter', 'Choose Pro', 'Manage subscription', 'Update payment method', 'Edit billing information']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled()
  expect(requests.sort()).toEqual([subscriptionEndpoint, plansEndpoint].sort())
})

test('billing independently waits for catalogue and subscription without using mock values', async ({ page }) => {
  const plansGate = deferred(), subscriptionGate = deferred()
  await mockApiRoute(page, plansEndpoint, async (route) => { await plansGate.promise; await fulfillJson(route, 200, [plan]) })
  await mockApiRoute(page, subscriptionEndpoint, async (route) => { await subscriptionGate.promise; await fulfillJson(route, 200, subscription) })
  await page.goto(billingPath)
  await expect(page.getByRole('status', { name: 'Loading plans' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Loading subscription' })).toBeVisible()
  await expect(page.getByText('Business', { exact: true })).toHaveCount(0)
  await capture(page, 'loading')
  plansGate.release()
  await expect(page.getByRole('article', { name: 'Business plan' })).toBeVisible()
  await expect(page.getByText('Current plan', { exact: true })).toHaveCount(0)
  subscriptionGate.release()
  await expect(page.getByRole('region', { name: 'Usage', exact: true })).toBeVisible()
})

test('billing distinguishes no subscription from unavailable history and empty catalogue', async ({ page }) => {
  await mockApiRoute(page, subscriptionEndpoint, (route) => fulfillJson(route, 200, noSubscription))
  await mockApiRoute(page, plansEndpoint, (route) => fulfillJson(route, 200, []))
  await page.goto(billingPath)
  await expect(page.getByText('No plans are available.', { exact: true })).toBeVisible()
  await expect(page.getByText('No current subscription.', { exact: false })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByText('Billing history unavailable', { exact: true })).toBeVisible()
  await capture(page, 'empty')
})

for (const [name, limit, used, note] of [['unlimited', null, 1234, null], ['zero', 0, 0, 'Limit reached'], ['reached', 10, 10, 'Limit reached'], ['exceeded', 10, 12, 'Limit exceeded']] as const) test(`billing handles ${name} quotas without inventing capacity`, async ({ page }) => {
  await mockApiRoute(page, subscriptionEndpoint, (route) => fulfillJson(route, 200, { ...subscription, nextBillingDate: null, status: 'SUSPENDED', plan: { ...plan, maxActiveUsers: limit }, usage: { ...subscription.usage, activeUsers: used } }))
  await page.goto(billingPath)
  await expect(page.getByRole('region', { name: 'Subscription', exact: true })).toContainText('SUSPENDED')
  await expect(page.getByText('Not provided', { exact: true })).toBeVisible()
  if (note) await expect(page.getByText(note, { exact: true })).toBeVisible()
  const progress = page.getByRole('progressbar', { name: 'Users usage' })
  if (limit === null || limit === 0) await expect(progress).toHaveCount(0)
  else await expect(progress).toHaveAttribute('aria-valuenow', '100')
  if (limit === null) await expect(page.getByRole('region', { name: 'Usage', exact: true })).toContainText('1,234 / Unlimited')
})

for (const source of ['plans', 'subscription']) for (const status of [403, 404, 500, 501]) test(`billing ${source} ${status} can retry independently`, async ({ page }) => {
  let fail = true
  await mockApiRoute(page, source === 'plans' ? plansEndpoint : subscriptionEndpoint, (route) => fulfillJson(route, fail ? status : 200, fail ? { message: 'PRIVATE_ERROR' } : source === 'plans' ? [plan] : subscription))
  await page.goto(billingPath)
  await expect(page.getByRole('button', { name: `Retry ${source}` })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PRIVATE_ERROR')
  if (source === 'plans') await expect(page.getByRole('region', { name: 'Usage', exact: true })).toBeVisible()
  else await expect(page.getByRole('article', { name: 'Business plan' })).toBeVisible()
  if (source === 'subscription' && status === 403) await capture(page, 'forbidden')
  if (source === 'plans' && status === 500) await capture(page, 'error')
  fail = false
  await page.getByRole('button', { name: `Retry ${source}` }).click()
  await expect(page.getByRole('button', { name: `Retry ${source}` })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Usage', exact: true })).toBeVisible()
})

for (const [name, payload] of [
  ['missing subscription', {}], ['inconsistent absent subscription', { ...noSubscription, plan }],
  ['missing limit', { ...subscription, plan: { code: 'BUSINESS', name: 'Business', features: [] } }],
  ['negative limit', { ...subscription, plan: { ...plan, maxActiveUsers: -1 } }],
  ['invalid date', { ...subscription, nextBillingDate: '2026-02-30' }],
  ['invalid usage', { ...subscription, usage: { ...subscription.usage, activeUsers: -1 } }],
  ['reversed period', { ...subscription, usage: { ...subscription.usage, periodStart: '2026-10-01' } }],
] as const) test(`billing rejects ${name}`, async ({ page }) => {
  await mockApiRoute(page, subscriptionEndpoint, (route) => fulfillJson(route, 200, payload))
  await page.goto(billingPath)
  await expect(page.getByRole('button', { name: 'Retry subscription' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Usage', exact: true })).toHaveCount(0)
})

for (const plans of [{}, [plan, plan], [{ ...plan, features: [null] }]]) test(`billing rejects invalid catalogue ${JSON.stringify(plans)}`, async ({ page }) => {
  await mockApiRoute(page, plansEndpoint, (route) => fulfillJson(route, 200, plans))
  await page.goto(billingPath)
  await expect(page.getByRole('button', { name: 'Retry plans' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)
})

for (const endpoint of [plansEndpoint, subscriptionEndpoint]) test(`billing expires authentication on ${endpoint} 401`, async ({ page }) => {
  await mockApiRoute(page, endpoint, (route) => fulfillJson(route, 401, {}))
  await page.goto(billingPath)
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY)).toBeNull()
})

for (const role of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) test(`billing denies ${role} without requests but permits the personal profile`, async ({ page }) => {
  await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code: role } })
  const requests: string[] = []
  page.on('request', (request) => { if (request.url().includes('subscription')) requests.push(request.url()) })
  await page.goto(billingPath)
  await expect(page.getByText('Billing access denied', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Billing', exact: true })).toHaveCount(0)
  expect(requests).toEqual([])
  await page.getByRole('link', { name: 'User profile', exact: true }).click()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(currentUser.email)
})

test('profile renders only the current identity, read-only fields and available navigation', async ({ page }) => {
  await mockCurrentUser(page, { ...currentUser, password: 'PRIVATE_PASSWORD', token: 'PRIVATE_TOKEN', lastLogin: 'PRIVATE_LOGIN' } as typeof currentUser)
  await page.goto(`${profilePath}?userId=999`)
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Alex')
  await expect(page.getByLabel('Last name', { exact: true })).toHaveValue('Martin')
  await expect(page.getByLabel('Current workspace')).toHaveValue('Acme')
  for (const input of await page.getByRole('textbox').all()) await expect(input).toHaveAttribute('readonly', '')
  await expect(page.locator('body')).not.toContainText('PRIVATE_')
  await expect(page.getByRole('button', { name: /save|remove|pay/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeDisabled()
  await expect(page.getByRole('navigation', { name: 'Settings categories' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Open security settings' }).click()
  await expect(page).toHaveURL(/\/settings\/security$/)
  await page.goBack()
  await page.getByRole('link', { name: 'Open notification preferences' }).click()
  await expect(page).toHaveURL(/\/settings\/notifications$/)
})

test('profile waits for a fresh response before showing its identity', async ({ page }) => {
  let calls = 0
  const gate = deferred()
  await mockApiRoute(page, '/v1/users/me', async (route) => {
    calls++
    if (calls > 1) await gate.promise
    await fulfillJson(route, 200, calls === 1 ? currentUser : { ...currentUser, firstName: 'Updated' })
  })
  await page.goto(profilePath)
  await expect(page.getByRole('status', { name: 'Loading profile' })).toBeVisible()
  await expect(page.getByLabel('First name', { exact: true })).toHaveCount(0)
  await capture(page, 'profile-loading')
  gate.release()
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Updated')
})

for (const status of [403, 404, 500, 501]) test(`profile handles ${status} without exposing server errors`, async ({ page }) => {
  let calls = 0, fail = true
  await mockApiRoute(page, '/v1/users/me', (route) => {
    calls++
    return fulfillJson(route, calls > 1 && fail ? status : 200, calls > 1 && fail ? { message: 'PRIVATE_ERROR' } : currentUser)
  })
  await page.goto(profilePath)
  await expect(page.getByRole('button', { name: 'Retry profile' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PRIVATE_ERROR')
  fail = false
  await page.getByRole('button', { name: 'Retry profile' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(currentUser.email)
})

for (const payload of [{ ...currentUser, id: 2 }, { ...currentUser, organization: { ...currentUser.organization, id: 2 } }, { ...currentUser, role: null }, null]) test(`profile rejects unexpected identity ${JSON.stringify(payload)}`, async ({ page }) => {
  let calls = 0
  await mockApiRoute(page, '/v1/users/me', (route) => fulfillJson(route, 200, ++calls === 1 ? currentUser : payload))
  await page.goto(profilePath)
  await expect(page.getByRole('button', { name: 'Retry profile' })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0)
})

test('profile expires authentication on a fresh 401', async ({ page }) => {
  let calls = 0
  await mockApiRoute(page, '/v1/users/me', (route) => fulfillJson(route, ++calls === 1 ? 200 : 401, currentUser))
  await page.goto(profilePath)
  await expect(page).toHaveURL(/\/login$/)
})

test('billing retries a network error and clears the old subscription on refresh', async ({ page }) => {
  await page.goto(billingPath)
  await expect(page.getByRole('region', { name: 'Usage', exact: true })).toBeVisible()
  const gate = deferred()
  await mockApiRoute(page, subscriptionEndpoint, async (route) => { await gate.promise; await route.abort('failed') })
  await page.getByRole('button', { name: 'Refresh billing' }).click()
  await expect(page.getByRole('status', { name: 'Loading subscription' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Usage', exact: true })).toHaveCount(0)
  gate.release()
  await expect(page.getByRole('button', { name: 'Retry subscription' })).toBeVisible()
  await mockApiRoute(page, subscriptionEndpoint, (route) => fulfillJson(route, 200, noSubscription))
  await page.getByRole('button', { name: 'Retry subscription' }).click()
  await expect(page.getByText('No current subscription.', { exact: false })).toBeVisible()
})

for (const width of [1440, 768, 390]) test(`profile and billing follow Figma and remain accessible at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.goto(profilePath)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(currentUser.email)
  await capture(page, `profile-${width}`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/settings')
  await page.getByRole('link', { name: 'Billing', exact: true }).press('Enter')
  await expect(page).toHaveURL(new RegExp(`${billingPath}$`))
  await expect(page.getByRole('region', { name: 'Usage', exact: true })).toBeVisible()
  await capture(page, `billing-${width}`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (width < 768) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'User profile', exact: true }).press('Enter')
  await expect(page).toHaveURL(new RegExp(`${profilePath}$`))
  await expect(page.getByLabel('First name', { exact: true })).toBeVisible()
  if (width < 768) await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0)
})

test('billing keeps a current plan absent from the active catalogue and ignores extra response fields', async ({ page }) => {
  await mockApiRoute(page, plansEndpoint, (route) => fulfillJson(route, 200, [starter]))
  await mockApiRoute(page, subscriptionEndpoint, (route) => fulfillJson(route, 200, { ...subscription, paymentToken: 'PRIVATE_TOKEN', invoiceContent: 'PRIVATE_INVOICE' }))
  await page.goto(billingPath)
  await expect(page.getByRole('region', { name: 'Subscription', exact: true })).toContainText('Business')
  await expect(page.getByRole('article', { name: 'Starter plan' }).getByText('Current plan', { exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('PRIVATE_')
})

test('profile clears stale identity on refresh and ignores a response after navigating away', async ({ page }) => {
  await page.goto(profilePath)
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Alex')
  const gate = deferred()
  let started = false
  await mockApiRoute(page, '/v1/users/me', async (route) => { started = true; await gate.promise; await fulfillJson(route, 200, { ...currentUser, firstName: 'Obsolete' }) })
  await page.getByRole('button', { name: 'Refresh profile' }).click()
  await expect.poll(() => started).toBe(true)
  await expect(page.getByLabel('First name', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Open security settings' }).click()
  gate.release()
  await expect(page).toHaveURL(/\/settings\/security$/)
  await expect(page.locator('body')).not.toContainText('Obsolete')
})

test('billing ignores an earlier subscription response after a refresh', async ({ page }) => {
  const gate = deferred()
  let calls = 0
  await mockApiRoute(page, subscriptionEndpoint, async (route) => {
    if (++calls === 1) { await gate.promise; await fulfillJson(route, 200, subscription) }
    else await fulfillJson(route, 200, noSubscription)
  })
  await page.goto(billingPath)
  await expect.poll(() => calls).toBe(1)
  await page.getByRole('button', { name: 'Refresh billing' }).click()
  await expect(page.getByText('No current subscription.', { exact: false })).toBeVisible()
  gate.release()
  await expect(page.getByText('No current subscription.', { exact: false })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
})
