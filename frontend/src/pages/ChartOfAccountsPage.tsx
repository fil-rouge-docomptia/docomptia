import { useEffect, useState } from 'react'
import { AlertCircle, BookOpen, Download, Plus, Search, Upload } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { AccountingSectionTabs } from '@/components/accounting/AccountingSectionTabs'
import { ChartOfAccountsTable } from '@/components/accounting/ChartOfAccountsTable'
import { accountColumns, compareAccounts, normalizeAccountSearch, type AccountSortColumn } from '@/components/accounting/chart-of-accounts-utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { getOrganizationAccounts } from '@/services/chart-of-accounts'
import type { ChartOfAccount } from '@/types/onboarding'

const pageSize = 8

export default function ChartOfAccountsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [retry, setRetry] = useState(0)
  const requestKey = `${user?.id}:${user?.organization.id}:${user?.role.code}:${retry}`
  const [result, setResult] = useState<{
    key: string
    accounts: ChartOfAccount[] | null
    error: unknown
  } | null>(null)
  const current = result?.key === requestKey ? result : null
  const accounts = current?.accounts
  const query = (params.get('query') ?? '').slice(0, 200)
  const search = normalizeAccountSearch(query)
  const types = [...new Set(accounts?.map((account) => account.accountType))].sort()
  const type = types.includes(params.get('type') ?? '') ? params.get('type')! : ''
  const status = ['active', 'inactive'].includes(params.get('status') ?? '') ? params.get('status')! : ''
  const sort = accountColumns.find((column) => column.key === params.get('sort'))?.key ?? 'accountNumber'
  const descending = params.get('direction') === 'desc'
  const filtered = accounts?.filter((account) => (
    (!type || account.accountType === type)
    && (!status || account.active === (status === 'active'))
    && [account.accountNumber, account.accountLabel].some((text) => normalizeAccountSearch(text).includes(search))
  )).sort((left, right) => compareAccounts(left, right, sort) * (descending ? -1 : 1)) ?? []
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const rawPage = Number(params.get('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, totalPages) : 1
  const hasFilters = Boolean(query || status || type)

  useEffect(() => {
    const controller = new AbortController()
    getOrganizationAccounts(controller.signal)
      .then((accounts) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, accounts, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, accounts: null, error })
      })
    return () => controller.abort()
  }, [requestKey])

  function update(updates: Record<string, string | null>, resetPage = true, replace = false) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (resetPage) next.delete('page')
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    }, { replace })
  }

  function changeSort(column: AccountSortColumn) {
    update({ sort: column, direction: sort === column && !descending ? 'desc' : 'asc' })
  }

  let content
  if (current?.error) {
    const forbidden = current.error instanceof ApiError && current.error.status === 403
    const unavailable = current.error instanceof ApiError && [404, 405, 501].includes(current.error.status)
    content = (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>{forbidden ? 'Chart of accounts access denied' : unavailable ? 'Chart of accounts unavailable' : 'Unable to load chart of accounts'}</AlertTitle>
        <AlertDescription>
          <p>{forbidden ? 'You do not have access to the accounts of this organization.'
            : unavailable ? 'The chart of accounts is not available at the moment.' : 'Check your connection, then try again.'}</p>
          {!forbidden && !unavailable ? <Button className="mt-3" onClick={() => setRetry((value) => value + 1)} variant="outline">Try again</Button> : null}
        </AlertDescription>
      </Alert>
    )
  } else if (!accounts) {
    content = (
      <div aria-label="Loading chart of accounts" className="space-y-3" role="status">
        <span className="sr-only">Loading chart of accounts</span>
        {Array.from({ length: pageSize }, (_, index) => <Skeleton className="h-10 w-full" key={index} />)}
      </div>
    )
  } else if (filtered.length === 0) {
    content = (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
        <BookOpen aria-hidden="true" className="mb-4 size-8 text-muted-foreground" />
        <h2 className="font-semibold">{accounts.length === 0 ? 'No accounts yet' : 'No matching accounts'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {accounts.length === 0 ? 'The accounts configured for your organization will appear here.' : 'Try another search or clear your filters.'}
        </p>
      </div>
    )
  } else {
    content = (
      <>
        <ChartOfAccountsTable accounts={filtered.slice((page - 1) * pageSize, page * pageSize)} descending={descending} onSort={changeSort} sort={sort} />
        <div aria-live="polite" className="sr-only">{filtered.length} accounts. Page {page} of {totalPages}.</div>
        <div className="[&_nav]:px-0 [&_nav>div]:gap-1 [&_nav_button]:min-h-11 [&_nav_button]:min-w-11 sm:[&_nav>div]:gap-2 sm:[&_nav_button]:min-h-10 sm:[&_nav_button]:min-w-10">
          <SupplierPagination ariaLabel="Account pagination" currentPage={page} itemLabel="accounts" onPageChange={(page) => update({ page: String(page) }, false)} pageSize={pageSize} totalElements={filtered.length} totalPages={totalPages} />
        </div>
      </>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        actions={(
          <div className="hidden gap-2 lg:flex">
            <Button disabled variant="outline"><Download aria-hidden="true" />Export</Button>
            {user?.role.code === 'ADMIN' ? <><Button disabled variant="secondary"><Upload aria-hidden="true" />Import CSV</Button><Button disabled><Plus aria-hidden="true" />Add account</Button></> : null}
          </div>
        )}
        description="Manage the accounts used to automatically generate accounting entries."
        title="Chart of accounts"
      />
      <AccountingSectionTabs value="accounts" />
      <section aria-label="Account list" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search account number or label" className="h-11 pl-9 sm:h-10" maxLength={200} onChange={(event) => update({ query: event.target.value }, true, true)} placeholder="Search accounts…" type="search" value={query} />
          </div>
          <Select disabled={!accounts} onValueChange={(value) => update({ type: value === 'all' ? null : value.slice(5) })} value={type ? `type:${type}` : 'all'}>
            <SelectTrigger aria-label="Account type" className="h-11 w-40 sm:h-10"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All types</SelectItem>{types.map((type) => <SelectItem key={type} value={`type:${type}`}>{type}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={(value) => update({ status: value === 'all' ? null : value })} value={status || 'all'}>
            <SelectTrigger aria-label="Account status" className="h-11 w-36 sm:h-10"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
          </Select>
          {hasFilters ? <Button onClick={() => update({ query: null, type: null, status: null })} variant="ghost">Clear filters</Button> : null}
        </div>
        {content}
      </section>
    </div>
  )
}
