import { expect, test } from '@playwright/test'

import {
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  seedAuthSession,
} from './support/api'

const supplierPage = {
  content: [
    {
      countryCode: 'FR',
      currentLegalIdentifiers: [
        {
          changeReason: null,
          countryCode: 'FR',
          createdAt: '2026-08-01T09:00:00',
          createdByUserId: 1,
          normalizedValue: '12345678900012',
          scheme: 'FR_SIRET',
          source: 'MANUAL',
          supplierLegalIdentifierId: 101,
          type: 'ESTABLISHMENT',
          updatedAt: '2026-08-01T09:00:00',
          validFrom: '2026-08-01',
          validTo: null,
          value: '12345678900012',
          verified: true,
        },
        {
          changeReason: null,
          countryCode: 'FR',
          createdAt: '2026-08-01T09:00:00',
          createdByUserId: 1,
          normalizedValue: 'FR12123456789',
          scheme: 'EU_VAT',
          source: 'MANUAL',
          supplierLegalIdentifierId: 102,
          type: 'VAT',
          updatedAt: '2026-08-01T09:00:00',
          validFrom: '2026-08-01',
          validTo: null,
          value: 'FR12 123456789',
          verified: true,
        },
        {
          changeReason: null,
          countryCode: 'FR',
          createdAt: '2026-08-01T09:00:00',
          createdByUserId: 1,
          normalizedValue: '123456789',
          scheme: 'FR_SIREN',
          source: 'MANUAL',
          supplierLegalIdentifierId: 103,
          type: 'BUSINESS_REGISTRATION',
          updatedAt: '2026-08-01T09:00:00',
          validFrom: '2026-08-01',
          validTo: null,
          value: '123456789',
          verified: true,
        },
      ],
      legalName: 'Leroy Construction SAS',
      name: 'Leroy Construction',
      siret: '12345678900012',
      supplierId: 42,
      tradeName: 'Leroy Construction',
      vatNumber: 'FR12123456789',
    },
    {
      countryCode: 'LU',
      currentLegalIdentifiers: [],
      legalName: 'Amazon Business EU S.à r.l.',
      name: 'Amazon Business EU',
      siret: null,
      supplierId: 43,
      tradeName: 'Amazon Business EU',
      vatNumber: 'LU26375245',
    },
  ],
  number: 0,
  size: 8,
  totalElements: 18,
  totalPages: 3,
}

const emptyPage = {
  content: [],
  number: 0,
  size: 8,
  totalElements: 0,
  totalPages: 0,
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
})

test('renders legal supplier data and opens the selected supplier', async ({ page }) => {
  await mockApiRoute(page, '/v1/suppliers*', (route) => fulfillJson(route, 200, supplierPage))

  await page.goto('/suppliers')

  await expect(page.getByRole('heading', { exact: true, name: 'Suppliers' })).toBeVisible()
  await expect(page.getByText('Leroy Construction SAS')).toBeVisible()
  await expect(page.getByText('12345678900012')).toBeVisible()
  await expect(page.getByText('FR12 123456789')).toBeVisible()
  await expect(page.getByText('FR_SIREN')).toBeVisible()
  await expect(page.getByText('LU26375245')).toBeVisible()
  await expect(page.getByText('1–8 of 18 suppliers')).toBeVisible()

  await page.getByRole('link', { name: 'Open supplier Leroy Construction SAS' }).click()

  await expect(page).toHaveURL(/\/suppliers\/42$/)
  await expect(page.getByRole('heading', { name: 'Supplier details' })).toBeVisible()
})

test('searches by legal identity and keeps pagination in the URL', async ({ page }) => {
  const requests: Array<{ page: string | null; query: string | null; size: string | null }> = []

  await mockApiRoute(page, '/v1/suppliers*', async (route) => {
    const requestUrl = new URL(route.request().url())
    requests.push({
      page: requestUrl.searchParams.get('page'),
      query: requestUrl.searchParams.get('query'),
      size: requestUrl.searchParams.get('size'),
    })
    await fulfillJson(route, 200, supplierPage)
  })

  await page.goto('/suppliers?page=2')
  await expect(page.getByText('Leroy Construction SAS')).toBeVisible()

  await page.getByLabel('Search suppliers').fill('FR12 123456789')

  await expect(page).toHaveURL(/query=FR12(?:\+|%20)123456789/)
  await expect(page).toHaveURL(/page=1/)
  await expect.poll(() => requests.at(-1)).toEqual({
    page: '0',
    query: 'FR12 123456789',
    size: '8',
  })

  await page.getByRole('button', { name: 'Page 2' }).click()

  await expect(page).toHaveURL(/page=2/)
  await expect.poll(() => requests.at(-1)).toEqual({
    page: '1',
    query: 'FR12 123456789',
    size: '8',
  })
})

test('shows a useful empty search state', async ({ page }) => {
  await mockApiRoute(page, '/v1/suppliers*', (route) => fulfillJson(route, 200, emptyPage))

  await page.goto('/suppliers?query=missing')

  await expect(page.getByRole('heading', { name: 'No matching suppliers' })).toBeVisible()
  await expect(page.getByText('Try searching by another legal name, SIRET or VAT number.')).toBeVisible()

  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page).not.toHaveURL(/query=/)
})

test('keeps request errors inside the supplier list page and retries', async ({ page }) => {
  let attempts = 0

  await mockApiRoute(page, '/v1/suppliers*', async (route) => {
    attempts += 1
    await fulfillJson(route, attempts === 1 ? 500 : 200, attempts === 1 ? {} : supplierPage)
  })

  await page.goto('/suppliers')

  await expect(page.getByText('Unable to load suppliers')).toBeVisible()
  await expect(page.getByRole('heading', { exact: true, name: 'Suppliers' })).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(page.getByText('Leroy Construction SAS')).toBeVisible()
  expect(attempts).toBe(2)
})
