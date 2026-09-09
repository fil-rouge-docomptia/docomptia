import { expect, test } from '@playwright/test'

import type { Customer } from '../src/types/customer'
import { currentUser, fulfillJson, mockApiRoute, mockCurrentUser, seedAuthSession } from './support/api'

const customer: Customer = {
  customerId: 41,
  name: 'Horizon',
  legalName: 'Horizon Services SAS',
  siret: '38012986600014',
  vatNumber: 'FR89380129866',
  email: 'billing@horizon.example',
  phone: '+33 1 42 00 00 00',
  address: '42 avenue de l’Opéra\n75002 Paris',
  active: true,
  createdAt: '2026-08-01T09:00:00',
  updatedAt: '2026-09-07T12:00:00',
}
const foreignCustomer: Customer = {
  ...customer, customerId: 42, name: 'North', legalName: 'North GmbH', siret: null,
  vatNumber: 'DE123456789', email: null, phone: null, address: null, active: false,
}
const clientPage = { content: [customer, foreignCustomer], number: 0, size: 8, totalElements: 2, totalPages: 1 }
const emptyPage = { ...clientPage, content: [], totalElements: 0, totalPages: 0 }

test.beforeEach(async ({ page }) => {
  await seedAuthSession(page)
  await mockCurrentUser(page)
  await mockApiRoute(page, '/v1/customers?*', (route) => fulfillJson(route, 200, clientPage))
  await mockApiRoute(page, '/v1/customers/41', (route) => fulfillJson(route, 200, customer))
  await mockApiRoute(page, '/v1/customers/42', (route) => fulfillJson(route, 200, foreignCustomer))
})

test('lists real client fields and opens the legal identity with the keyboard', async ({ page }) => {
  await page.goto('/clients')
  const table = page.getByRole('table', { name: 'Clients', exact: true })
  await expect(table.getByText(customer.legalName)).toBeVisible()
  await expect(table.getByText(customer.siret!)).toBeVisible()
  await expect(table.getByText(foreignCustomer.vatNumber!)).toBeVisible()
  await expect(table.getByText('Inactive', { exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Client pagination' })).toContainText('1–2 of 2 clients')
  const open = table.getByRole('link', { name: `Open client ${customer.legalName}` })
  await open.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/clients\/41\?page=1$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(customer.legalName)
  await expect(page.getByText('Trading name: Horizon')).toBeVisible()
  await expect(page.getByText('billing@horizon.example', { exact: false })).toBeVisible()
  await expect(page.getByText('42 avenue de l’Opéra', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'Back to clients' }).click()
  await expect(table).toBeVisible()
})

test('uses only the authenticated customer contract and leaves unavailable features explicit', async ({ page }) => {
  const requests: string[] = []
  await mockApiRoute(page, '/v1/customers**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.method()).toBe('GET')
    expect(request.headers().authorization).toBe('Bearer e2e-token')
    if (url.pathname.endsWith('/customers')) {
      expect([...url.searchParams.entries()]).toEqual([['page', '0'], ['size', '8']])
    } else {
      expect(url.search).toBe('')
    }
    await fulfillJson(route, 200, url.pathname.endsWith('/41') ? customer : clientPage)
  })
  page.on('request', (request) => {
    if (/\/api\/v1\/(invoices|customer-invoices|classifications|accounting|customers)/.test(request.url())) {
      requests.push(new URL(request.url()).pathname)
    }
  })
  await page.goto('/clients?organizationId=999&query=ignored&status=active')
  await expect(page.getByLabel('Search clients', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Status', exact: true })).toBeDisabled()
  await expect(page.getByText('Search and status filters are not available yet.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add client' })).toBeDisabled()
  await page.getByRole('link', { name: `Open client ${customer.legalName}` }).click()
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  for (const name of ['Invoices', 'Accounting', 'Activity']) {
    await expect(page.getByRole('tab', { name, exact: true })).toBeDisabled()
  }
  await expect(page.getByRole('button', { name: 'Edit client' })).toBeDisabled()
  await expect(page.getByLabel('Invoice volume', { exact: true })).toContainText('Not available yet')
  await expect(page.getByLabel('Recorded revenue', { exact: true })).not.toContainText('0.00')
  await expect(page.getByText('The client activity history is not available yet.')).toBeVisible()
  await expect(page.getByText('Client project links are not available yet.')).toBeVisible()
  expect(requests.filter((path) => !path.startsWith('/api/v1/customers'))).toEqual([])
})

test('toggles table columns without altering customer data', async ({ page }) => {
  await page.goto('/clients')
  await page.getByRole('button', { name: 'Columns', exact: true }).click()
  const column = page.getByRole('checkbox', { name: 'VAT number', exact: true })
  await column.uncheck()
  await expect(page.getByRole('columnheader', { name: 'VAT number', exact: true })).toHaveCount(0)
  await column.check()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('columnheader', { name: 'VAT number', exact: true })).toBeVisible()
  await expect(page.getByText(customer.vatNumber!)).toBeVisible()
})

test('paginates on the server and restores the list page from the profile', async ({ page }) => {
  await mockApiRoute(page, '/v1/customers?*', async (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'))
    await fulfillJson(route, 200, {
      ...clientPage, number, content: number === 0 ? [foreignCustomer] : [customer], totalElements: 16, totalPages: 2,
    })
  })
  await page.goto('/clients')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page).toHaveURL(/page=2$/)
  await page.getByRole('link', { name: `Open client ${customer.legalName}` }).click()
  await page.getByRole('link', { name: 'Back to clients' }).click()
  await expect(page).toHaveURL(/\/clients\?page=2$/)
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page.getByText(foreignCustomer.legalName)).toBeVisible()
})

test('ignores a delayed client page after navigating back', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  await mockApiRoute(page, '/v1/customers?*', async (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'))
    if (number === 1) await pending
    await fulfillJson(route, 200, {
      ...clientPage, number, content: number === 0 ? [customer] : [foreignCustomer], totalElements: 16, totalPages: 2,
    })
  })
  await page.goto('/clients')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByRole('status', { name: 'Loading clients', exact: true })).toBeVisible()
  await expect(page.getByText(customer.legalName)).toHaveCount(0)
  await page.goBack()
  await expect(page.getByText(customer.legalName)).toBeVisible()
  release()
  await expect(page.getByText(foreignCustomer.legalName)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('keeps long client pagination contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApiRoute(page, '/v1/customers?*', (route) => fulfillJson(route, 200, {
    ...clientPage, number: 4, totalElements: 80, totalPages: 10,
  }))
  await page.goto('/clients?page=5')
  const pagination = page.getByRole('navigation', { name: 'Client pagination' })
  await expect(pagination.getByRole('button', { name: 'Page 10', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('shows empty and out-of-range client pages without invented records', async ({ page }) => {
  await mockApiRoute(page, '/v1/customers?*', (route) => fulfillJson(route, 200, emptyPage))
  await page.goto('/clients?page=99')
  await expect(page.getByText('No clients on this page')).toBeVisible()
  await page.getByRole('button', { name: 'Back to first page' }).click()
  await expect(page.getByText('No clients yet')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Open client/ })).toHaveCount(0)
})

test('normalizes invalid client page parameters before calling the API', async ({ page }) => {
  await mockApiRoute(page, '/v1/customers?*', async (route) => {
    expect(new URL(route.request().url()).searchParams.get('page')).toBe('0')
    await fulfillJson(route, 200, clientPage)
  })
  for (const value of ['-2', '1.5', 'nope', '99999999999999999999']) {
    await page.goto(`/clients?page=${value}`)
    await expect(page.getByRole('table', { name: 'Clients', exact: true })).toBeVisible()
  }
})

for (const [path, loadingLabel] of [['/clients', 'Loading clients'], ['/clients/41', 'Loading client details']]) {
  test(`exposes loading and retry states for ${path}`, async ({ page }) => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    let failed = false
    await mockApiRoute(page, '/v1/customers**', async (route) => {
      if (!failed) {
        await pending
        failed = true
        await fulfillJson(route, 503, {})
      } else {
        await fulfillJson(route, 200, path === '/clients' ? clientPage : customer)
      }
    })
    await page.goto(path)
    await expect(page.getByRole('status', { name: loadingLabel, exact: true })).toBeVisible()
    release()
    await expect(page.getByText('Unable to load clients')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText(customer.legalName, { exact: true }).first()).toBeVisible()
  })
}

for (const status of [404, 405, 501]) {
  test(`disables the client module when its endpoint returns ${status}`, async ({ page }) => {
    await mockApiRoute(page, '/v1/customers?*', (route) => fulfillJson(route, status, {}))
    await page.goto('/clients')
    await expect(page.getByText('Clients module unavailable', { exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Open client/ })).toHaveCount(0)
  })
}

test('does not expose a client from another organization or reuse the previous profile', async ({ page }) => {
  await page.goto('/clients/41')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(customer.legalName)
  await mockApiRoute(page, '/v1/customers/41', (route) => fulfillJson(route, 404, { code: 'CUSTOMER_NOT_FOUND' }))
  await page.getByRole('link', { name: 'Back to clients' }).click()
  await page.getByRole('link', { name: `Open client ${customer.legalName}` }).click()
  await expect(page.getByText('Client not found', { exact: true })).toBeVisible()
  await expect(page.getByText(customer.email!, { exact: false })).toHaveCount(0)
  await expect(page.getByText(customer.legalName, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('tablist')).toHaveCount(0)
})

test('rejects invalid client identifiers without requesting any customer', async ({ page }) => {
  const requests: string[] = []
  await mockApiRoute(page, '/v1/customers**', async (route) => {
    requests.push(route.request().url())
    await fulfillJson(route, 404, {})
  })
  for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992']) {
    await page.goto(`/clients/${id}`)
    await expect(page.getByText('Client not found', { exact: true })).toBeVisible()
  }
  expect(requests).toEqual([])
})

for (const path of ['/clients', '/clients/41']) {
  test(`respects denied client access on ${path}`, async ({ page }) => {
    await mockApiRoute(page, '/v1/customers**', (route) => fulfillJson(route, 403, {}))
    await page.goto(path)
    await expect(page.getByText('Client access denied', { exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByText(customer.legalName)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  })
}

test('returns to login when the customer request reports an expired session', async ({ page }) => {
  await mockApiRoute(page, '/v1/customers?*', (route) => fulfillJson(route, 401, {}))
  await page.goto('/clients')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText(customer.legalName)).toHaveCount(0)
})

test('keeps international and inactive clients readable without inventing missing fields', async ({ page }) => {
  await mockApiRoute(page, '/v1/customers/42', (route) => fulfillJson(route, 200, {
    ...foreignCustomer, createdAt: null, updatedAt: null,
  }))
  await page.goto('/clients/42')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(foreignCustomer.legalName)
  await expect(page.getByText('Inactive', { exact: true })).toBeVisible()
  await expect(page.getByText(foreignCustomer.vatNumber!)).toBeVisible()
  await expect(page.locator('dl').first()).toContainText('Not provided')
  await expect(page.getByText(customer.siret!)).toHaveCount(0)
  await expect(page.getByText('Invalid Date')).toHaveCount(0)
})

for (const [role, width] of [['ADMIN', 1440], ['OPERATEUR_COMPTABLE', 768], ['RESPONSABLE_COMPTABLE', 390]] as const) {
  test(`keeps client consultation responsive for ${role} at ${width}px`, async ({ page }, testInfo) => {
    await mockCurrentUser(page, { ...currentUser, role: { id: 1, code: role, label: role } })
    await page.setViewportSize({ width, height: 1024 })
    await page.goto('/clients')
    await expect(page.getByRole('table', { name: 'Clients', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`clients-${width}.png`), fullPage: true })
    await page.getByRole('link', { name: `Open client ${customer.legalName}` }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(customer.legalName)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`client-detail-${width}.png`), fullPage: true })
  })
}
