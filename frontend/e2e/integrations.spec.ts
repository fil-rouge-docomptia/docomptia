import { expect, test } from '@playwright/test'

import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('integrations distinguish unavailable connections from existing file exports', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/') && !/\/users\/me|\/notifications/.test(request.url())) requests.push(request.url())
  })
  await page.goto('/integrations')
  await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()
  await expect(page.getByText('External connections are not available yet', { exact: true })).toBeVisible()
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(7)
  await expect(page.getByText('File exports', { exact: true })).toBeVisible()
  await expect(page.getByText(/^(Connected|Active|Available|Success)$/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^View .* details$/ })).toHaveCount(8)
  expect(requests).toEqual([])
})

for (const [id, name] of [
  ['sage', 'Sage'], ['ebp', 'EBP'], ['pennylane', 'Pennylane'],
  ['dedicated-email', 'Dedicated email'], ['platform-provider', 'Platform provider / PA'],
  ['api', 'API'], ['webhooks', 'Webhooks'],
]) test(`integrations show honest details for ${name} without collecting credentials`, async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/') && !/\/users\/me|\/notifications/.test(request.url())) requests.push(request.url())
  })
  await page.goto('/integrations')
  await page.getByRole('link', { name: `View ${name} details`, exact: true }).click()
  await expect(page).toHaveURL(`/integrations/${id}`)
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  for (const action of ['Configure', 'Test connection', 'Disconnect']) {
    const button = page.getByRole('button', { name: action, exact: true })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAccessibleDescription(/No credentials can be entered or saved here/)
  }
  await expect(page.locator('main input, main textarea, main select')).toHaveCount(0)
  await expect(page.getByText('Connection history is not available.', { exact: true })).toBeVisible()
  await expect(page.getByText(/^(Connected|Success|Passed|Active)$/)).toHaveCount(0)
  await page.getByRole('link', { name: 'All integrations', exact: true }).click()
  await expect(page).toHaveURL('/integrations')
  expect(requests).toEqual([])
})

test('integrations link file exports to the existing export center', async ({ page }) => {
  await page.goto('/integrations/accounting-exports')
  await expect(page.getByText('This does not establish a connection to external software.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: /Configure|Test connection|Disconnect/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Open export center' }).press('Enter')
  await expect(page).toHaveURL('/exports')
})

for (const suffix of ['unknown', 'new', 'SAGE', '%3Cscript%3E']) test(`integrations reject the unknown option ${suffix}`, async ({ page }, testInfo) => {
  await page.goto(`/integrations/${suffix}`)
  await expect(page.getByRole('heading', { name: 'Integration not found' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Connection actions' })).toHaveCount(0)
  if (suffix === 'unknown') await page.screenshot({ path: testInfo.outputPath('integration-not-found.png'), fullPage: true })
  await page.getByRole('link', { name: 'All integrations' }).click()
  await expect(page).toHaveURL('/integrations')
})

for (const step of ['configuration', 'test', 'success']) test(`integrations cannot force the ${step} step from the URL`, async ({ page }) => {
  await page.goto(`/integrations/sage?step=${step}&status=Connected&apiKey=PRIVATE_TEST_SECRET&organizationId=999`)
  await expect(page.getByText('Connection unavailable', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PRIVATE_TEST_SECRET')
  await expect(page.getByText(/^(Connected|Success|Passed)$/)).toHaveCount(0)
  await expect(page.locator('main input')).toHaveCount(0)
})

for (const role of ['OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE']) {
  for (const path of ['/integrations', '/integrations/sage', '/integrations/accounting-exports']) test(`integrations deny ${role} at ${path}`, async ({ page }, testInfo) => {
    await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code: role } })
    await page.goto(path)
    await expect(page.getByText('Integrations access denied', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Integrations', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^View .* details$|Open export center/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Connection status', exact: true })).toHaveCount(0)
    if (role === 'OPERATEUR_COMPTABLE' && path === '/integrations') await page.screenshot({ path: testInfo.outputPath('integrations-denied.png'), fullPage: true })
  })
}

test('integrations wait for the authenticated identity and reject an expired session', async ({ page }) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, '/v1/users/me', async (route) => { await pending; await fulfillJson(route, 401, {}) })
  await page.goto('/integrations/sage')
  await expect(page.getByRole('main', { name: 'Loading session' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sage', exact: true })).toHaveCount(0)
  release()
  await expect(page).toHaveURL('/login')
})

for (const width of [1440, 768, 390]) test(`integrations follow the Figma layout and support keyboard navigation at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1100 })
  await page.goto('/integrations')
  await expect(page.getByRole('heading', { name: 'Accounting software' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath(`integrations-${width}.png`), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const detail = page.getByRole('link', { name: 'View Dedicated email details', exact: true })
  await detail.focus()
  await expect(detail).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/integrations/dedicated-email')
  await expect(page.getByRole('heading', { name: 'Connection status', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath(`integration-details-${width}.png`), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: 'All integrations' }).press('Enter')
  await expect(page).toHaveURL('/integrations')
  await page.goBack()
  await expect(page).toHaveURL('/integrations/dedicated-email')
})
