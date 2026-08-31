import { expect, test } from '@playwright/test'

import {
  AUTH_TOKEN_STORAGE_KEY,
  currentUser,
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
} from './support/api'

test.describe('authentication journeys', () => {
  test('redirects an anonymous visitor away from a private route', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Welcome to Docomptia' })).toBeVisible()
  })

  test('signs in and opens the private workspace', async ({ page }) => {
    await mockApiRoute(page, '/v1/auth/login', (route) =>
      fulfillJson(route, 200, {
        userId: currentUser.id,
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        role: currentUser.role.code,
        organizationId: currentUser.organization.id,
        token: 'e2e-token',
      }),
    )
    await mockCurrentUser(page)
    await mockApiRoute(page, '/v1/organizations/current/onboarding', (route) =>
      fulfillJson(route, 200, {
        progressPercentage: 100,
        completedStepCount: 4,
        totalStepCount: 4,
        completedSteps: [],
        remainingActions: [],
      }),
    )

    await page.goto('/login')
    await page.getByLabel('Work email').fill('alex.martin@example.com')
    await page.getByLabel('Password').fill('password')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect
      .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY))
      .toBe('e2e-token')
  })

  test('clears an expired session and returns to sign in', async ({ page }) => {
    await seedAuthSession(page)
    await mockApiRoute(page, '/v1/users/me', (route) =>
      fulfillJson(route, 401, { message: 'Session expired' }),
    )

    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Welcome to Docomptia' })).toBeVisible()
    await expect
      .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY))
      .toBeNull()
  })

  test('signs out and removes the local session', async ({ page }) => {
    await seedAuthSession(page)
    await mockCurrentUser(page)

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Sign out' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect
      .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), AUTH_TOKEN_STORAGE_KEY))
      .toBeNull()
  })
})
