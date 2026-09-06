import { expect, test } from '@playwright/test'

import {
  currentUser,
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  readOnlyPermissions,
  seedAuthSession,
} from './support/api'

const projectSite = {
  active: true,
  classificationId: 42,
  createdAt: '2026-03-04T09:00:00',
  description: 'Residential construction project in Lyon.',
  name: 'Résidence Bellevue',
  type: 'CHANTIER',
  updatedAt: '2026-08-30T14:30:00',
}

const projectSitePage = {
  content: [
    projectSite,
    {
      active: false,
      classificationId: 43,
      createdAt: '2026-01-12T08:00:00',
      description: null,
      name: 'Entrepôt Nord',
      type: 'CHANTIER',
      updatedAt: '2026-07-18T11:15:00',
    },
  ],
  number: 0,
  size: 8,
  totalElements: 18,
  totalPages: 3,
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('lists organization projects and opens the selected construction site', async ({ page }) => {
  const listRequests: URL[] = []

  await mockApiRoute(page, '/v1/classifications*', async (route) => {
    const requestUrl = new URL(route.request().url())
    listRequests.push(requestUrl)
    await fulfillJson(route, 200, projectSitePage)
  })
  await mockApiRoute(page, '/v1/classifications/42', (route) => (
    fulfillJson(route, 200, projectSite)
  ))

  await page.goto('/projects')

  await expect(page.getByRole('heading', { exact: true, name: 'Projects & sites' })).toBeVisible()
  await expect(page.getByText('Résidence Bellevue')).toBeVisible()
  await expect(page.getByText('Entrepôt Nord')).toBeVisible()
  await expect(page.getByText('1–8 of 18 projects & sites')).toBeVisible()
  await expect(page.getByLabel('Search projects and sites')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Client' })).toBeDisabled()
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('type')).toBe('CHANTIER')
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('page')).toBe('0')
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('size')).toBe('8')

  await page.getByRole('button', { name: 'Page 2' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(() => listRequests.at(-1)?.searchParams.get('page')).toBe('1')

  await page.getByRole('link', { name: 'Open project or site Résidence Bellevue' }).click()
  await expect(page).toHaveURL(/\/projects\/42$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Résidence Bellevue' })).toBeVisible()
})

test('keeps unsupported project resources explicit and does not fetch unrelated data', async ({ page }) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    const requestUrl = new URL(request.url())
    if (requestUrl.pathname.startsWith('/api/')) {
      apiRequests.push(requestUrl.pathname)
    }
  })
  await mockApiRoute(page, '/v1/classifications/42', (route) => fulfillJson(route, 200, projectSite))

  await page.goto('/projects/42')

  await expect(page.getByRole('heading', { name: 'Project information' })).toBeVisible()
  await expect(page.getByText('Residential construction project in Lyon.')).toBeVisible()

  await page.getByRole('tab', { name: 'Invoices' }).click()
  await expect(page).toHaveURL(/tab=invoices/)
  await expect(page.getByRole('heading', { name: 'Project invoices unavailable' })).toBeVisible()

  await page.getByRole('tab', { name: 'Suppliers' }).click()
  await expect(page).toHaveURL(/tab=suppliers/)
  await expect(page.getByRole('heading', { name: 'Project suppliers unavailable' })).toBeVisible()

  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page).toHaveURL(/tab=activity/)
  await expect(page.getByRole('heading', { name: 'Project activity unavailable' })).toBeVisible()

  expect(apiRequests.filter((path) => path.includes('/invoices'))).toEqual([])
  expect(apiRequests.filter((path) => path.includes('/suppliers'))).toEqual([])
})

test('lets an administrator create and edit construction sites with the supported fields', async ({ page }) => {
  let createBody: unknown
  let updateBody: unknown
  const createdProjectSite = {
    ...projectSite,
    classificationId: 44,
    description: 'New operating site.',
    name: 'Campus Horizon',
  }

  await mockApiRoute(page, '/v1/classifications*', async (route) => {
    if (route.request().method() === 'POST') {
      createBody = route.request().postDataJSON()
      await fulfillJson(route, 201, createdProjectSite)
      return
    }

    await fulfillJson(route, 200, projectSitePage)
  })
  await mockApiRoute(page, '/v1/classifications/42', async (route) => {
    if (route.request().method() === 'PATCH') {
      updateBody = route.request().postDataJSON()
      await fulfillJson(route, 200, {
        ...projectSite,
        description: 'Updated residential project.',
        name: 'Résidence Bellevue II',
      })
      return
    }

    await fulfillJson(route, 200, projectSite)
  })

  await page.goto('/projects')
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByLabel('Project / Site name').fill('Campus Horizon')
  await page.getByLabel('Description').fill('New operating site.')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(createBody).toEqual({
    description: 'New operating site.',
    name: 'Campus Horizon',
    type: 'CHANTIER',
  })

  await page.goto('/projects/42')
  await page.getByRole('button', { name: 'Edit project' }).click()
  await page.getByLabel('Project / Site name').fill('Résidence Bellevue II')
  await page.getByLabel('Description').fill('Updated residential project.')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Résidence Bellevue II' })).toBeVisible()
  expect(updateBody).toEqual({
    description: 'Updated residential project.',
    name: 'Résidence Bellevue II',
  })
})

test('keeps project management actions hidden without management permission', async ({ page }) => {
  await mockApiRoute(page, '/v1/users/me', (route) => fulfillJson(route, 200, {
    ...currentUser,
    role: { ...currentUser.role, code: 'VIEWER', label: 'Viewer' },
    roles: [{ ...currentUser.role, code: 'VIEWER', label: 'Viewer' }],
    permissions: readOnlyPermissions,
  }))
  await mockApiRoute(page, '/v1/classifications*', (route) => (
    fulfillJson(route, 200, projectSitePage)
  ))
  await mockApiRoute(page, '/v1/classifications/42', (route) => (
    fulfillJson(route, 200, projectSite)
  ))

  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: 'Projects & sites' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create project' })).toHaveCount(0)

  await page.goto('/projects/42')
  await expect(page.getByRole('heading', { name: 'Résidence Bellevue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit project' })).toHaveCount(0)
})
