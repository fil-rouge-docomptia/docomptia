import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  AUTH_TOKEN_STORAGE_KEY,
  PENDING_REGISTRATION_EMAIL_KEY,
  currentUser,
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
} from './support/api'

const breakpoints = [
  { name: 'desktop', width: 1440 },
  { name: 'compact desktop', width: 1024 },
  { name: 'tablet', width: 768 },
  { name: 'mobile', width: 390 },
]

async function expectNoHorizontalOverflow(page: Page, surface: string) {
  const layout = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth
    const scrollWidth = document.documentElement.scrollWidth
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.left < -1 || rect.right > clientWidth + 1
      })
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`)

    return { clientWidth, offenders, scrollWidth }
  })

  expect(
    layout.scrollWidth,
    `${surface} overflows by ${layout.scrollWidth - layout.clientWidth}px: ${layout.offenders.join(', ')}`,
  ).toBeLessThanOrEqual(layout.clientWidth)
}

test.describe('global states', () => {
  test('announces the session loading state', async ({ page }) => {
    await seedAuthSession(page)

    let releaseProfile: () => void = () => undefined
    const profileGate = new Promise<void>((resolve) => {
      releaseProfile = resolve
    })

    await mockApiRoute(page, '/v1/users/me', async (route) => {
      await profileGate
      await fulfillJson(route, 200, currentUser)
    })

    await page.goto('/dashboard')
    await expect(page.getByLabel('Loading session')).toBeVisible()

    releaseProfile()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('keeps the invoice empty state visible', async ({ page }) => {
    await seedAuthSession(page)
    await mockCurrentUser(page)

    await page.goto('/inbox')

    await expect(
      page.getByText('Le tableau des champs extraits apparaitra ici apres un upload reussi.'),
    ).toBeVisible()
  })

  test('announces a sign-in error', async ({ page }) => {
    await mockApiRoute(page, '/v1/auth/login', (route) =>
      fulfillJson(route, 401, { message: 'Invalid credentials' }),
    )

    await page.goto('/login')
    await page.getByLabel('Work email').fill('alex.martin@example.com')
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.getByRole('alert')).toContainText(
      'Unable to sign in. Check your credentials and try again.',
    )
  })

  test('announces successful email verification', async ({ page }) => {
    await page.addInitScript(
      ({ key }) => window.sessionStorage.setItem(key, 'alex.martin@example.com'),
      { key: PENDING_REGISTRATION_EMAIL_KEY },
    )

    await page.goto('/verify-email')
    await page.getByLabel('Verification code').fill('123456')
    await page.getByRole('button', { name: 'Verify email' }).click()

    await expect(page.getByLabel('Preparing your workspace')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('alert')).toContainText(
      'Your email is verified. Sign in to continue.',
    )
  })
})

test.describe('responsive breakpoints', () => {
  for (const breakpoint of breakpoints) {
    test(`avoids blocking overflow at ${breakpoint.width}px (${breakpoint.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: breakpoint.width, height: 900 })

      await page.goto('/login')
      await expect(page.getByRole('heading', { name: 'Welcome to Docomptia' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'Login')

      await mockCurrentUser(page)
      await mockApiRoute(page, '/v1/organizations/current', (route) =>
        fulfillJson(route, 200, {
          organizationId: 1,
          name: 'Acme',
          legalName: 'Acme SAS',
          siret: '12345678901234',
          email: 'billing@acme.test',
          phone: null,
          address: '1 Main Street',
          defaultCurrencyCode: 'EUR',
        }),
      )
      await page.evaluate(
        ({ key }) => window.sessionStorage.setItem(key, 'e2e-token'),
        { key: AUTH_TOKEN_STORAGE_KEY },
      )

      await page.goto('/inbox')
      await expect(page.getByRole('heading', { name: 'Resultat OCR' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'Private workspace')

      await page.goto('/onboarding/company')
      await expect(page.getByRole('heading', { name: 'Company information' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'Onboarding')
    })
  }
})
