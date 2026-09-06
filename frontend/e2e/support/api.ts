import type { Page, Route } from '@playwright/test'

export const AUTH_TOKEN_STORAGE_KEY = 'docomptia.authToken'
export const PENDING_REGISTRATION_EMAIL_KEY = 'docomptia.pending-registration-email'

export const allPermissions = [
  'user.profile.read',
  'reference-data.read',
  'organization.read',
  'organization.manage',
  'dashboard.read',
  'invoice.read',
  'invoice.upload',
  'invoice.correct',
  'invoice.submit-for-validation',
  'invoice.retry-ocr',
  'invoice.review-duplicate',
  'invoice.assign',
  'invoice.classify',
  'invoice.approve',
  'invoice.accounting.generate',
  'accounting-entry.update',
  'supplier.read',
  'supplier.manage',
  'accounting-configuration.read',
  'accounting-configuration.manage',
  'classification.read',
  'classification.manage',
  'member.read',
  'member.invite',
  'member.update',
  'member.status.update',
  'member.role.update',
  'member.owner.manage',
  'role.read',
]

export const approvalPermissions = [
  'user.profile.read',
  'reference-data.read',
  'organization.read',
  'dashboard.read',
  'invoice.read',
  'invoice.approve',
  'supplier.read',
  'accounting-configuration.read',
  'classification.read',
]

export const readOnlyPermissions = [
  'user.profile.read',
  'reference-data.read',
  'organization.read',
  'dashboard.read',
  'invoice.read',
  'supplier.read',
  'accounting-configuration.read',
  'classification.read',
]

export const currentUser = {
  id: 1,
  firstName: 'Alex',
  lastName: 'Martin',
  email: 'alex.martin@example.com',
  role: {
    id: 1,
    code: 'OWNER',
    label: 'Owner',
  },
  roles: [{
    id: 1,
    code: 'OWNER',
    label: 'Owner',
  }],
  permissions: allPermissions,
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
