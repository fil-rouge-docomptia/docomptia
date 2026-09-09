import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Plus, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { entryTypeLabels } from '@/components/accounting/accounting-utils'
import { AccountingEntryDetails } from '@/components/accounting/AccountingEntryDetails'
import { AccountingEntryTable } from '@/components/accounting/AccountingEntryTable'
import { AccountingLoadError } from '@/components/accounting/AccountingLoadError'
import { AccountingSectionTabs } from '@/components/accounting/AccountingSectionTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { listAccountingEntries } from '@/services/accounting'
import type { AccountingEntryPage } from '@/types/accounting'

export default function AccountingPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [retry, setRetry] = useState(0)
  const [compact, setCompact] = useState(true)
  const query = (params.get('query') ?? '').trim().slice(0, 200)
  const rawBalance = params.get('balanced') ?? ''
  const balanced = ['true', 'false'].includes(rawBalance) ? rawBalance : ''
  const rawStatus = params.get('status') ?? ''
  const status = Object.hasOwn(entryTypeLabels, rawStatus) ? rawStatus : ''
  const rawPage = Number(params.get('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 2147483647 ? rawPage : 1
  const entryId = params.get('entry')
  const identity = `${user?.id}:${user?.organization.id}`
  const requestKey = JSON.stringify([identity, query, balanced, status, page, retry])
  const [result, setResult] = useState<{
    key: string
    data: AccountingEntryPage | null
    error: unknown
  } | null>(null)
  const current = result?.key === requestKey ? result : null
  const data = current?.data
  const hasFilters = Boolean(query || balanced || status)

  useEffect(() => {
    const controller = new AbortController()
    listAccountingEntries({ page: page - 1, query, balanced, status }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error })
      })
    return () => controller.abort()
  }, [page, query, balanced, status, requestKey])

  const update = (updates: Record<string, string | null>, resetPage = true) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    if (resetPage) next.delete('page')
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    return next
  })

  let content
  if (current?.error) {
    content = <AccountingLoadError error={current.error} onRetry={() => setRetry((value) => value + 1)} />
  } else if (!data) {
    content = (
      <div aria-label="Loading accounting entries" className="space-y-3" role="status">
        <span className="sr-only">Loading accounting entries</span>
        {Array.from({ length: 8 }, (_, index) => <Skeleton className="h-10 w-full" key={index} />)}
      </div>
    )
  } else if (data.content.length === 0) {
    content = (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
        <FileSpreadsheet aria-hidden="true" className="mb-4 size-8 text-muted-foreground" />
        <h2 className="font-semibold">
          {page > 1 ? 'No entries on this page' : hasFilters ? 'No matching entries' : 'No accounting entries yet'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {page > 1 ? 'Return to the first page to see available entries.'
            : hasFilters ? 'Try another search or clear your filters.'
              : 'Entries generated for your organization will appear here.'}
        </p>
        {page > 1 ? (
          <Button className="mt-4" onClick={() => update({ page: null })} variant="outline">Back to first page</Button>
        ) : null}
      </div>
    )
  } else {
    content = (
      <>
        <AccountingEntryTable
          compact={compact}
          onOpen={(id) => update({ entry: String(id) }, false)}
          records={data.content}
        />
        <SupplierPagination
          ariaLabel="Accounting pagination"
          currentPage={data.number + 1}
          itemLabel="accounting entries"
          onPageChange={(page) => update({ page: String(page) }, false)}
          pageSize={data.size}
          totalElements={data.totalElements}
          totalPages={data.totalPages}
        />
      </>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Accounting"
        description="Review, balance and export accounting entries."
        actions={(
          <>
            <Button disabled title="Entry export will be available in the export workflow.">
              <Download aria-hidden="true" />Export entries
            </Button>
            <Button disabled variant="secondary" title="Entries are generated from validated invoices.">
              <Plus aria-hidden="true" />Create entry
            </Button>
          </>
        )}
      />
      <AccountingSectionTabs value="entries" />
      <section aria-label="Accounting entry list" className="min-w-0 space-y-4">
        <div aria-label="Balance views" className="flex flex-wrap gap-1 border-b border-border pb-2" role="group">
          {([['All', ''], ['Balanced', 'true'], ['Needs attention', 'false']] as const).map(([label, value]) => (
            <Button
              aria-pressed={balanced === value}
              className="text-xs"
              key={label}
              onClick={() => update({ balanced: value })}
              variant={balanced === value ? 'outline' : 'secondary'}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form
            aria-label="Accounting search"
            className="flex w-full gap-2 sm:max-w-md"
            key={query}
            onSubmit={(event) => {
              event.preventDefault()
              update({ query: String(new FormData(event.currentTarget).get('query') ?? '').trim() })
            }}
            role="search"
          >
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search entries"
                className="h-10 pl-9"
                defaultValue={query}
                maxLength={200}
                name="query"
                placeholder="Search entries, invoices, suppliers…"
                type="search"
              />
            </div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
          <Select value={status || 'all'} onValueChange={(value) => update({ status: value === 'all' ? null : value })}>
            <SelectTrigger aria-label="Entry type" className="h-10 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entry types</SelectItem>
              {Object.entries(entryTypeLabels).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button onClick={() => update({ query: null, balanced: null, status: null })} variant="ghost">Clear filters</Button>
          ) : null}
          <div aria-label="Table density" className="flex items-center gap-1 sm:ml-auto" role="group">
            <span className="mr-1 text-xs text-muted-foreground">Density</span>
            {([['Comfortable', false], ['Compact', true]] as const).map(([label, value]) => (
              <Button aria-pressed={compact === value} className="text-xs" key={label} onClick={() => setCompact(value)} variant={compact === value ? 'outline' : 'secondary'}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        {content}
      </section>
      {entryId !== null ? (
        <AccountingEntryDetails id={entryId} key={`${identity}:${entryId}`} onClose={() => update({ entry: null }, false)} />
      ) : null}
    </div>
  )
}
