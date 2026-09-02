import type { Page, Route } from '@playwright/test'

export const AUTH_TOKEN_STORAGE_KEY = 'docomptia.authToken'
export const PENDING_REGISTRATION_EMAIL_KEY = 'docomptia.pending-registration-email'

export const currentUser = {
  id: 1,
  firstName: 'Alex',
  lastName: 'Martin',
  email: 'alex.martin@example.com',
  role: {
    id: 1,
    code: 'ADMIN',
    label: 'Administrator',
  },
  organization: {
    id: 1,
    name: 'Acme',
    legalName: 'Acme SAS',
  },
}

const corsHeaders = {
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-allow-origin': '*',
}

export async function fulfillJson(route: Route, status: number, body: unknown) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: corsHeaders })
    return
  }

  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body),
  })
}

export async function mockApiRoute(
  page: Page,
  path: string,
  handler: (route: Route) => Promise<void>,
) {
  await page.route(`**/api${path}`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }

    await handler(route)
  })
}

export async function mockCurrentUser(page: Page, user = currentUser) {
  await mockApiRoute(page, '/v1/users/me', (route) => fulfillJson(route, 200, user))
}

export async function seedAuthSession(page: Page) {
  await page.addInitScript(
    ({ key }) => window.sessionStorage.setItem(key, 'e2e-token'),
    { key: AUTH_TOKEN_STORAGE_KEY },
  )
}
