import { expect, test, type Page, type Route } from '@playwright/test'

import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const folder = { classificationId: 11, type: 'DOSSIER', name: 'Purchases', description: 'Supplier invoices and supporting documents', active: true, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' }
const binder = { ...folder, classificationId: 12, type: 'CLASSEUR', name: 'Annual accounts', description: null }
const site = { ...folder, classificationId: 13, type: 'CHANTIER', name: 'Résidence Bellevue', description: 'Construction project' }
const inactive = { ...folder, classificationId: 14, name: 'Archive 2025', active: false }
const categories = [binder, site, inactive, folder]
const endpoint = '/v1/classifications'
const pageData = (content = categories, number = 0, totalElements = content.length) => ({ content, number, size: 8, totalElements, totalPages: Math.ceil(totalElements / 8) })
const categoryRow = (page: Page, name: string) => page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) })

async function mockList(page: Page, handler?: (route: Route) => Promise<void>) {
  await mockApiRoute(page, `${endpoint}?*`, handler ?? ((route) => fulfillJson(route, 200, pageData())))
}

async function openCategories(page: Page, query = '') {
  await page.goto(`/settings/categories${query}`)
  await expect(page.getByRole('table', { name: 'Organization categories' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockList(page)
})

test('category settings loads the organization list and keeps inactive classifications visible', async ({ page }, testInfo) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockList(page, async (route) => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(Object.fromEntries(new URL(route.request().url()).searchParams)).toEqual({ page: '0', size: '8' })
    await pending
    await fulfillJson(route, 200, pageData())
  })
  await page.goto('/settings/categories?organizationId=999')
  await expect(page.getByRole('status', { name: 'Loading categories' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create category', exact: true })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('categories-loading.png'), fullPage: true })
  release()
  await expect(categoryRow(page, inactive.name).getByText('Inactive', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Deactivate ${inactive.name}`, exact: true })).toHaveCount(0)
  await expect(page.getByText('1–4 of 4 categories', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /delete|reactivate/i })).toHaveCount(0)
})

test('category settings paginates and filters on the server with back navigation', async ({ page }) => {
  await mockList(page, async (route) => {
    const params = new URL(route.request().url()).searchParams
    const number = Number(params.get('page'))
    const type = params.get('type')
    expect(params.get('size')).toBe('8')
    await fulfillJson(route, 200, pageData(type === 'CLASSEUR' ? [binder] : number === 1 ? [folder] : [site], number, type ? 1 : 9))
  })
  await openCategories(page)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page).toHaveURL('/settings/categories?page=2')
  await expect(page.getByText('9–9 of 9 categories', { exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Filter by type' }).click()
  await page.getByRole('option', { name: 'Binder', exact: true }).click()
  await expect(page).toHaveURL('/settings/categories?type=CLASSEUR')
  await expect(categoryRow(page, binder.name)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
  await page.goBack()
  await expect(page).toHaveURL('/settings/categories?page=2')
  await expect(categoryRow(page, folder.name)).toBeVisible()
})

for (const query of ['', '?type=CHANTIER', '?page=99']) {
  test(`category settings shows the empty state ${query || 'without categories'}`, async ({ page }, testInfo) => {
    await mockList(page, (route) => fulfillJson(route, 200, pageData([], Number(new URL(route.request().url()).searchParams.get('page')))))
    await page.goto(`/settings/categories${query}`)
    await expect(page.getByRole('heading', { name: query.includes('page') ? 'No categories on this page' : query ? 'No categories of this type' : 'No categories yet' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create category', exact: true })).toBeEnabled()
    await page.screenshot({ path: testInfo.outputPath('categories-empty.png'), fullPage: true })
    if (query.includes('page')) {
      await page.getByRole('button', { name: 'First page', exact: true }).click()
      await expect(page).toHaveURL('/settings/categories')
    }
  })
}

for (const status of [403, 404, 500]) {
  test(`category settings handles list ${status} and retry`, async ({ page }, testInfo) => {
    let fail = true
    await mockList(page, (route) => fulfillJson(route, fail ? status : 200, fail ? { message: 'Unavailable' } : pageData()))
    await page.goto('/settings/categories')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create category', exact: true })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath(`categories-error-${status}.png`), fullPage: true })
    fail = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(categoryRow(page, folder.name)).toBeVisible()
  })
}

for (const role of ['RESPONSABLE_COMPTABLE', 'OPERATEUR_COMPTABLE']) {
  test(`category settings allows ${role} to read but not mutate`, async ({ page }, testInfo) => {
    await mockCurrentUser(page, { ...currentUser, role: { ...currentUser.role, code: role } })
    await openCategories(page)
    await expect(page.getByText('Only administrators can manage categories. You have read-only access.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Create category|Edit |Deactivate )/ })).toHaveCount(0)
    await expect(categoryRow(page, inactive.name)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('categories-readonly.png'), fullPage: true })
  })
}

test('category settings creates once with trimmed input and waits for backend confirmation', async ({ page }, testInfo) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  let creates = 0
  let saved = false
  const created = { ...binder, classificationId: 20, name: 'Closing 2026', description: 'Year-end documents' }
  await mockList(page, (route) => fulfillJson(route, 200, pageData(saved ? [created] : categories)))
  await mockApiRoute(page, endpoint, async (route) => {
    creates++
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers().authorization).toBe('Bearer e2e-token')
    expect(route.request().postDataJSON()).toEqual({ type: 'CLASSEUR', name: 'Closing 2026', description: 'Year-end documents' })
    await pending
    saved = true
    await fulfillJson(route, 201, created)
  })
  await openCategories(page)
  await page.getByRole('button', { name: 'Create category', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused()
  await dialog.getByRole('combobox', { name: 'Type', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('option', { name: 'Binder', exact: true }).click()
  await dialog.getByLabel('Name', { exact: true }).fill(' Closing 2026 ')
  await dialog.getByLabel('Description (optional)').fill(' Year-end documents ')
  await dialog.getByRole('button', { name: 'Create category', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(dialog.getByRole('form')).toHaveAttribute('aria-busy', 'true')
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(page.getByText('Category created.', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('categories-saving.png'), fullPage: true })
  release()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Category created.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL('/settings/categories?type=CLASSEUR')
  await expect(categoryRow(page, created.name)).toBeVisible()
  expect(creates).toBe(1)
})

test('category settings validates a blank name and cancels without creating', async ({ page }) => {
  let mutations = 0
  page.on('request', (request) => { if (['PATCH', 'POST'].includes(request.method())) mutations++ })
  await openCategories(page)
  const create = page.getByRole('button', { name: 'Create category', exact: true })
  await create.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('  ')
  await dialog.getByRole('button', { name: 'Create category', exact: true }).click()
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveAccessibleDescription('Enter a category name.')
  await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(create).toBeFocused()
  expect(mutations).toBe(0)
})

test('category settings patches only changed fields and keeps type immutable', async ({ page }) => {
  let saved = folder
  let patches = 0
  await mockList(page, (route) => fulfillJson(route, 200, pageData([saved])))
  await mockApiRoute(page, `${endpoint}/${folder.classificationId}`, async (route) => {
    patches++
    expect(route.request().method()).toBe('PATCH')
    expect(route.request().postDataJSON()).toEqual({ description: '' })
    saved = { ...folder, description: '' }
    await fulfillJson(route, 200, { ...saved, description: null })
  })
  await openCategories(page)
  await page.getByRole('button', { name: `Edit ${folder.name}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Type', { exact: true })).toHaveAttribute('readonly', '')
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await dialog.getByLabel('Name', { exact: true }).fill(` ${folder.name} `)
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await dialog.getByLabel('Description (optional)').fill(' ')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Category updated.', { exact: true })).toBeVisible()
  await expect(categoryRow(page, folder.name).getByText('No description')).toBeVisible()
  expect(patches).toBe(1)
})

for (const action of ['create', 'edit'] as const) {
  test(`category settings handles a ${action} name conflict and permits correction`, async ({ page }, testInfo) => {
    let fail = true
    await mockApiRoute(page, action === 'create' ? endpoint : `${endpoint}/${folder.classificationId}`, (route) => fulfillJson(route, fail ? 409 : 200, fail ? { code: 'CLASSIFICATION_CONFLICT', message: 'Name conflict' } : { ...folder, name: 'Unique name' }))
    await openCategories(page)
    await page.getByRole('button', { name: action === 'create' ? 'Create category' : `Edit ${folder.name}`, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill(inactive.name)
    await dialog.getByRole('button', { name: action === 'create' ? 'Create category' : 'Save changes', exact: true }).click()
    await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused()
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveAccessibleDescription('This name is already used for this type, including inactive categories.')
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue(inactive.name)
    await page.screenshot({ path: testInfo.outputPath(`categories-conflict-${action}.png`), fullPage: true })
    fail = false
    await dialog.getByLabel('Name', { exact: true }).fill('Unique name')
    await dialog.getByRole('button', { name: action === 'create' ? 'Create category' : 'Save changes', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  })
}

test('category settings confirms deactivation, waits for the server and keeps the historical row', async ({ page }, testInfo) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  let deactivations = 0
  await mockApiRoute(page, `${endpoint}/${folder.classificationId}/deactivate`, async (route) => {
    deactivations++
    expect(route.request().method()).toBe('POST')
    expect(route.request().postData()).toBeNull()
    await pending
    await fulfillJson(route, 200, { ...folder, active: false })
  })
  await openCategories(page)
  const button = page.getByRole('button', { name: `Deactivate ${folder.name}`, exact: true })
  await button.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await expect(dialog.getByText(/Existing invoice links are kept/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(button).toBeFocused()
  expect(deactivations).toBe(0)
  await button.click()
  await page.screenshot({ path: testInfo.outputPath('categories-deactivate.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Deactivate category', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(dialog.getByRole('button', { name: 'Deactivating…' })).toBeDisabled()
  await expect(page.getByRole('row', { includeHidden: true }).filter({ hasText: folder.name }).getByText('Active', { exact: true })).toBeVisible()
  release()
  await expect(dialog).toHaveCount(0)
  await expect(categoryRow(page, folder.name).getByText('Inactive', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Deactivate ${folder.name}`, exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Filter by type' })).toBeFocused()
  await expect(page.getByText('1–4 of 4 categories', { exact: true })).toBeVisible()
  expect(deactivations).toBe(1)
  await page.screenshot({ path: testInfo.outputPath('categories-success.png'), fullPage: true })
})

for (const action of ['edit', 'deactivate'] as const) {
  for (const status of [400, 403, 404, 500]) {
    test(`category settings preserves data after ${action} ${status}`, async ({ page }) => {
      await mockApiRoute(page, `${endpoint}/${folder.classificationId}${action === 'deactivate' ? '/deactivate' : ''}`, (route) => fulfillJson(route, status, { message: 'Rejected' }))
      await openCategories(page)
      await page.getByRole('button', { name: `${action === 'edit' ? 'Edit' : 'Deactivate'} ${folder.name}`, exact: true }).click()
      const dialog = page.getByRole('dialog')
      if (action === 'edit') await dialog.getByLabel('Name', { exact: true }).fill('Pending change')
      const submit = dialog.getByRole('button', { name: action === 'edit' ? 'Save changes' : 'Deactivate category', exact: true })
      await submit.click()
      await expect(dialog.getByRole('alert')).toBeVisible()
      if ([403, 404].includes(status)) await expect(submit).toBeDisabled()
      else await expect(submit).toBeEnabled()
      if (action === 'edit') await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Pending change')
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(categoryRow(page, folder.name).getByText('Active', { exact: true })).toBeVisible()
      await expect(page.getByText(/Category updated\.|Category deactivated\./)).toHaveCount(0)
    })
  }
}

test('category settings handles session expiry during a mutation', async ({ page }) => {
  await mockApiRoute(page, endpoint, (route) => fulfillJson(route, 401, { message: 'Session expired' }))
  await openCategories(page)
  await page.getByRole('button', { name: 'Create category', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('Unsaved category')
  await dialog.getByRole('button', { name: 'Create category', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.getByText('Category created.', { exact: true })).toHaveCount(0)
})

test('category settings discards a stale response when the type filter changes', async ({ page }) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockList(page, async (route) => {
    if (!new URL(route.request().url()).searchParams.has('type')) await pending
    await fulfillJson(route, 200, pageData(new URL(route.request().url()).searchParams.has('type') ? [binder] : [folder]))
  })
  await page.goto('/settings/categories')
  await expect(page.getByRole('status', { name: 'Loading categories' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Filter by type' }).click()
  await page.getByRole('option', { name: 'Binder', exact: true }).click()
  await expect(categoryRow(page, binder.name)).toBeVisible()
  release()
  await expect(categoryRow(page, folder.name)).toHaveCount(0)
  await expect(categoryRow(page, binder.name)).toBeVisible()
})

test('category settings ignores a late mutation after leaving the page', async ({ page }) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, endpoint, async (route) => {
    await pending
    await fulfillJson(route, 201, { ...folder, name: 'Late category' })
  })
  await openCategories(page)
  await page.getByRole('button', { name: 'Create category', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('Late category')
  await dialog.getByRole('button', { name: 'Create category', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeVisible()
  // Browser navigation can leave the route while a modal mutation is pending.
  await page.evaluate(() => {
    window.history.pushState(null, '', '/integrations')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible()
  release()
  await expect(page.getByText('Category created.', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('link', { name: 'Categories', exact: true }).click()
  await expect(categoryRow(page, folder.name)).toBeVisible()
  await expect(page.getByText('Late category', { exact: true })).toHaveCount(0)
})

for (const width of [1440, 768, 390]) {
  test(`category settings is usable at ${width}px with keyboard navigation`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/settings')
    await page.getByRole('link', { name: 'Categories', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/settings/categories')
    await expect(categoryRow(page, folder.name)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`categories-${width}.png`), fullPage: true })
    const edit = page.getByRole('button', { name: `Edit ${folder.name}`, exact: true })
    await edit.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog').getByLabel('Name', { exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`categories-dialog-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(edit).toBeFocused()
    if (width < 1024) {
      await page.getByRole('link', { name: 'All settings', exact: true }).click()
      await expect(page.getByRole('link', { name: 'General', exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Categories', exact: true })).toBeVisible()
    }
  })
}
