import { expect, test } from '@playwright/test'

import {
  currentUser,
  fulfillJson,
  mockApiRoute,
  mockCurrentUser,
  readOnlyPermissions,
  seedAuthSession,
} from './support/api'

const currentSiret = {
  changeReason: 'Initial registration',
  countryCode: 'FR',
  createdAt: '2026-08-01T09:00:00',
  createdByUserId: 1,
  identifierId: 101,
  normalizedValue: '12345678900012',
  scheme: 'FR_SIRET',
  source: 'MANUAL',
  type: 'ESTABLISHMENT',
  updatedAt: '2026-08-01T09:00:00',
  validFrom: '2026-08-01',
  validTo: null,
  value: '12345678900012',
  verified: true,
}

const currentVatNumber = {
  changeReason: 'Initial registration',
  countryCode: 'FR',
  createdAt: '2026-08-01T09:00:00',
  createdByUserId: 1,
  identifierId: 102,
  normalizedValue: 'FR12123456789',
  scheme: 'EU_VAT',
  source: 'MANUAL',
  type: 'VAT',
  updatedAt: '2026-08-01T09:00:00',
  validFrom: '2026-08-01',
  validTo: null,
  value: 'FR12 123456789',
  verified: true,
}

const replacedSiret = {
  ...currentSiret,
  changeReason: 'Establishment relocation',
  identifierId: 99,
  updatedAt: '2026-07-31T16:00:00',
  validFrom: '2025-01-15',
  validTo: '2026-07-31',
  value: '12345678900004',
}

const supplierDetails = {
  address: '12 rue des Ateliers, 75011 Paris',
  countryCode: 'FR',
  createdAt: '2025-01-15T08:30:00',
  currentLegalIdentifiers: [currentSiret, currentVatNumber],
  email: 'contact@leroy-construction.fr',
  legalIdentifierHistory: [currentSiret, currentVatNumber, replacedSiret],
  legalName: 'Leroy Construction SAS',
  name: 'Leroy Construction',
  phone: '+33 1 42 00 00 00',
  siret: '12345678900012',
  supplierId: 42,
  tradeName: 'Leroy Construction',
  updatedAt: '2026-08-30T14:30:00',
  vatNumber: 'FR12123456789',
}

const invoicePage = {
  content: [
    {
      currencyCode: 'EUR',
      dueDate: '2026-09-12',
      invoiceDate: '2026-08-13',
      invoiceId: 201,
      invoiceNumber: 'INV-2026-0421',
      status: 'EXTRAITE',
      supplierName: 'Leroy Construction',
      totalTtc: '1500.60',
    },
    {
      currencyCode: 'EUR',
      dueDate: '2026-08-20',
      invoiceDate: '2026-07-21',
      invoiceId: 202,
      invoiceNumber: 'INV-2026-0398',
      status: 'VALIDEE',
      supplierName: 'Leroy Construction',
      totalTtc: '840.00',
    },
  ],
  number: 0,
  size: 4,
  totalElements: 2,
  totalPages: 1,
}

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/suppliers/42', (route) => (
    fulfillJson(route, 200, supplierDetails)
  ))
})

test('renders the supplier profile and its four data-backed tabs', async ({ page }) => {
  const invoiceRequests: URL[] = []
  await mockApiRoute(page, '/v1/invoices*', async (route) => {
    const requestUrl = new URL(route.request().url())
    invoiceRequests.push(requestUrl)
    await fulfillJson(route, 200, {
      ...invoicePage,
      size: Number(requestUrl.searchParams.get('size')),
    })
  })

  await page.goto('/suppliers/42')

  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction SAS' })).toBeVisible()
  await expect(page.getByText('12345678900012')).toBeVisible()
  await expect(page.getByText('FR12 123456789')).toBeVisible()
  await expect(page.getByText('contact@leroy-construction.fr · +33 1 42 00 00 00')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent invoices' })).toBeVisible()
  await expect(page.getByText('INV-2026-0421')).toBeVisible()
  await expect.poll(() => invoiceRequests.at(-1)?.searchParams.get('supplier')).toBe('42')

  await page.getByRole('tab', { name: 'Invoices' }).click()
  await expect(page).toHaveURL(/tab=invoices/)
  await expect(page.getByRole('heading', { name: 'Supplier invoices' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open invoice INV-2026-0421' })).toBeVisible()
  await expect.poll(() => invoiceRequests.at(-1)?.searchParams.get('size')).toBe('6')
  await expect.poll(() => invoiceRequests.at(-1)?.searchParams.get('supplier')).toBe('42')

  await page.getByRole('tab', { name: 'Accounting' }).click()
  await expect(page.getByText('No supplier-specific rule is available.')).toBeVisible()
  await expect(page.getByText('Not configured')).toBeVisible()

  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByText(/Establishment relocation/)).toBeVisible()
  await expect(page.getByText('Supplier profile created')).toBeVisible()
})

test('updates editable profile fields for an authorized role', async ({ page }) => {
  let updateBody: unknown
  await mockApiRoute(page, '/v1/suppliers/42', async (route) => {
    if (route.request().method() === 'PATCH') {
      updateBody = route.request().postDataJSON()
      await fulfillJson(route, 200, {
        ...supplierDetails,
        legalName: 'Leroy Construction Groupe SAS',
        phone: '+33 1 42 00 11 22',
        updatedAt: '2026-09-02T11:00:00',
      })
      return
    }

    await fulfillJson(route, 200, supplierDetails)
  })
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, invoicePage))

  await page.goto('/suppliers/42')
  await page.getByRole('button', { name: 'Edit supplier' }).click()
  await page.getByLabel('Legal name').fill('Leroy Construction Groupe SAS')
  await page.getByLabel('Phone').fill('+33 1 42 00 11 22')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Leroy Construction Groupe SAS',
  })).toBeVisible()
  expect(updateBody).toEqual({
    address: '12 rue des Ateliers, 75011 Paris',
    email: 'contact@leroy-construction.fr',
    legalName: 'Leroy Construction Groupe SAS',
    name: 'Leroy Construction',
    phone: '+33 1 42 00 11 22',
  })
})

test('keeps the supplier data visible when a SIRET replacement is rejected', async ({ page }) => {
  let replacementBody: unknown
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, invoicePage))
  await mockApiRoute(page, '/v1/suppliers/42/legal-identifiers/101', async (route) => {
    replacementBody = route.request().postDataJSON()
    await fulfillJson(route, 400, {
      code: 'SUPPLIER_VALIDATION_ERROR',
      message: 'siret must keep the current French SIREN for this supplier',
    })
  })

  await page.goto('/suppliers/42')
  await page.getByRole('button', { name: 'Edit supplier' }).click()
  await page.getByRole('button', { name: 'Replace SIRET 12345678900012' }).click()
  await page.getByLabel('New SIRET').fill('73282932000074')
  await page.getByLabel('Replacement reason').fill('Establishment relocation')
  await page.getByRole('button', { name: 'Replace SIRET', exact: true }).click()

  await expect(page.getByRole('alert')).toContainText(
    'siret must keep the current French SIREN for this supplier',
  )
  await expect(page.getByLabel('New SIRET')).toHaveValue('73282932000074')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction SAS' })).toBeVisible()
  expect(replacementBody).toEqual({
    countryCode: 'FR',
    reason: 'Establishment relocation',
    scheme: 'FR_SIRET',
    type: 'ESTABLISHMENT',
    value: '73282932000074',
  })
})

test('keeps supplier editing unavailable without supplier management permission', async ({ page }) => {
  await mockApiRoute(page, '/v1/users/me', (route) => fulfillJson(route, 200, {
    ...currentUser,
    role: { ...currentUser.role, code: 'VIEWER', label: 'Viewer' },
    roles: [{ ...currentUser.role, code: 'VIEWER', label: 'Viewer' }],
    permissions: readOnlyPermissions,
  }))
  await mockApiRoute(page, '/v1/invoices*', (route) => fulfillJson(route, 200, invoicePage))

  await page.goto('/suppliers/42')

  await expect(page.getByRole('heading', { level: 1, name: 'Leroy Construction SAS' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit supplier' })).toHaveCount(0)
})
