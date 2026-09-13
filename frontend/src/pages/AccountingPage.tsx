import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Plus, Search, Columns3, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { entryTypeLabels, entryColumns, entrySortFields, type EntryColumn } from '@/components/accounting/accounting-utils'
import { AccountingEntryCreateSheet } from '@/components/accounting/AccountingEntryCreateSheet'
import { AccountingEntryDetails } from '@/components/accounting/AccountingEntryDetails'
import { AccountingEntryTable } from '@/components/accounting/AccountingEntryTable'
import { AccountingLoadError } from '@/components/accounting/AccountingLoadError'
import { AccountingSectionTabs } from '@/components/accounting/AccountingSectionTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ApiError } from '@/services/api'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { listAccountingEntries, getAccountingJournals } from '@/services/accounting'
import type { AccountingEntryPage, AccountingJournal } from '@/types/accounting'

function readColumns(identity: string): EntryColumn[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`docomptia.accounting.columns.${identity}`) ?? '["type","invoiceStatus","invoice"]')
    return Array.isArray(value) ? value.filter((item): item is EntryColumn => entryColumns.some(([key]) => key === item)) : []
  } catch { return [] }
}

export default function AccountingPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [retry, setRetry] = useState(0)
  const [compact, setCompact] = useState(true)
  const [creationIdentity, setCreationIdentity] = useState<string | null>(null)
  const query = (params.get('query') ?? '').trim().slice(0, 200)
  const rawBalance = params.get('balanced') ?? ''
  const balanced = ['true', 'false'].includes(rawBalance) ? rawBalance : ''
  const rawStatus = params.get('status') ?? ''
  const status = Object.hasOwn(entryTypeLabels, rawStatus) ? rawStatus : ''
  const rawPage = Number(params.get('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 2147483647 ? rawPage : 1
  const view = ['attention', 'ready'].includes(params.get('view') ?? '') ? params.get('view')! : ''
  const startDate = params.get('startDate') ?? ''
  const endDate = params.get('endDate') ?? ''
  const journalId = /^\d+$/.test(params.get('journalId') ?? '') && Number(params.get('journalId')) > 0 ? params.get('journalId')! : ''
  const exportStatus = ['NOT_EXPORTED', 'EXPORTED'].includes(params.get('exportStatus') ?? '') ? params.get('exportStatus')! : ''
  const sortBy = Object.hasOwn(entrySortFields, params.get('sortBy') ?? '') ? params.get('sortBy')! : 'entryDate'
  const direction = params.get('direction') === 'ASC' ? 'ASC' : 'DESC'
  const invalidDates = [startDate, endDate].some((date) => date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) || Boolean(startDate && endDate && startDate > endDate)
  const entryId = params.get('entry')
  const identity = `${user?.id}:${user?.organization.id}`
  const requestKey = JSON.stringify([identity, query, balanced, status, page, retry, view, startDate, endDate, journalId, exportStatus, sortBy, direction])
  const [columns, setColumns] = useState(() => ({ identity, hidden: readColumns(identity) }))
  const hidden = columns.identity === identity ? columns.hidden : readColumns(identity)
  const [journalResult, setJournalResult] = useState<{ key: string; journals: AccountingJournal[]; error: boolean } | null>(null)
  const journalKey = `${identity}:${retry}`
  const journals = journalResult?.key === journalKey ? journalResult.journals : []
  useEffect(() => {
    const controller = new AbortController()
    getAccountingJournals(controller.signal).then((journals) => {
      if (!controller.signal.aborted) setJournalResult({ key: journalKey, journals, error: false })
    }).catch(() => {
      if (!controller.signal.aborted) setJournalResult({ key: journalKey, journals: [], error: true })
    })
    return () => controller.abort()
  }, [journalKey])
  const [result, setResult] = useState<{
    key: string
    data: AccountingEntryPage | null
    error: unknown
  } | null>(null)
  const current = result?.key === requestKey ? result : null
  const data = current?.data
  const hasFilters = Boolean(query || balanced || status || view || startDate || endDate || journalId || exportStatus)

  useEffect(() => {
    if (invalidDates) return
    const controller = new AbortController()
    listAccountingEntries({ page: page - 1, query, balanced, status, view, startDate, endDate, journalId, exportStatus, sortBy, direction }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error })
      })
    return () => controller.abort()
  }, [page, query, balanced, status, requestKey, invalidDates, view, startDate, endDate, journalId, exportStatus, sortBy, direction])

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
  if (invalidDates) {
    content = <AccountingLoadError error={new ApiError(400, undefined, 'Choose a valid date range.')} onRetry={() => update({ startDate: null, endDate: null })} />
  } else if (current?.error) {
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
        {!hasFilters && page === 1 ? <Button className="mt-4" onClick={() => setCreationIdentity(identity)}>Create entry</Button> : null}
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
          records={data.content} hidden={hidden} sortBy={sortBy} direction={direction}
          onSort={(field) => update({ sortBy: field, direction: field === sortBy && direction === 'ASC' ? 'DESC' : 'ASC' })}
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
            <Button id="create-entry" onClick={() => setCreationIdentity(identity)} variant="secondary">
              <Plus aria-hidden="true" />Create entry
            </Button>
          </>
        )}
      />
      <AccountingSectionTabs value="entries" />
      <section aria-label="Accounting entry list" className="min-w-0 space-y-4">
        <div aria-label="Balance views" className="flex flex-wrap gap-1 border-b border-border pb-2" role="group">
          {([['All', 'all'], ['Balanced', 'balanced'], ['Needs attention', 'attention'], ['Ready to export', 'ready'], ['Exported', 'exported']] as const).map(([label, value]) => {
            const selected = (view || (balanced === 'true' ? 'balanced' : exportStatus === 'EXPORTED' ? 'exported' : 'all')) === value
            return <Button aria-pressed={selected} className="text-xs" key={value} variant={selected ? 'outline' : 'secondary'}
              onClick={() => update({ view: ['attention', 'ready'].includes(value) ? value : null, balanced: value === 'balanced' ? 'true' : null, exportStatus: value === 'exported' ? 'EXPORTED' : null })}>{label}</Button>
          })}
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
            <Button onClick={() => update({ query: null, balanced: null, status: null, view: null, startDate: null, endDate: null, journalId: null, exportStatus: null })} variant="ghost">Clear all</Button>
          ) : null}
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Columns3 aria-hidden="true" />Columns</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">{entryColumns.map(([key, label]) => <DropdownMenuCheckboxItem key={key} checked={!hidden.includes(key)} onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => {
                const next = checked ? hidden.filter((item) => item !== key) : [...hidden, key]
                setColumns({ identity, hidden: next })
                try { localStorage.setItem(`docomptia.accounting.columns.${identity}`, JSON.stringify(next)) } catch { /* Preferences remain available for this session. */ }
              }}>{label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
          </DropdownMenu>
          <div aria-label="Table density" className="flex items-center gap-1 sm:ml-auto" role="group">
            <span className="mr-1 text-xs text-muted-foreground">Density</span>
            {([['Comfortable', false], ['Compact', true]] as const).map(([label, value]) => (
              <Button aria-pressed={compact === value} className="text-xs" key={label} onClick={() => setCompact(value)} variant={compact === value ? 'outline' : 'secondary'}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3" aria-label="Entry filters">
          <label className="space-y-1 text-xs">From date<Input aria-label="From date" type="date" value={startDate} onChange={(event) => update({ startDate: event.target.value })} className="w-40" /></label>
          <label className="space-y-1 text-xs">To date<Input aria-label="To date" type="date" value={endDate} onChange={(event) => update({ endDate: event.target.value })} className="w-40" /></label>
          <Select value={journalId || 'all'} onValueChange={(value) => update({ journalId: value === 'all' ? null : value })}>
            <SelectTrigger aria-label="Journal" className="w-44"><SelectValue placeholder="All journals" /></SelectTrigger><SelectContent><SelectItem value="all">All journals</SelectItem>
              {journals.map((journal) => <SelectItem key={journal.accountingJournalId} value={String(journal.accountingJournalId)}>{journal.code} — {journal.label}{journal.active ? '' : ' (inactive)'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={balanced || 'all'} onValueChange={(value) => update({ balanced: value === 'all' ? null : value, view: null })}>
            <SelectTrigger aria-label="Balance" className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any balance</SelectItem><SelectItem value="true">Balanced</SelectItem><SelectItem value="false">Unbalanced</SelectItem></SelectContent>
          </Select>
          <Select value={exportStatus || 'all'} onValueChange={(value) => update({ exportStatus: value === 'all' ? null : value })}>
            <SelectTrigger aria-label="Export status" className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any export status</SelectItem><SelectItem value="NOT_EXPORTED">Not exported</SelectItem><SelectItem value="EXPORTED">Exported</SelectItem></SelectContent>
          </Select>
          {journalResult?.key === journalKey && journalResult.error ? <p role="alert" className="text-xs text-destructive">Unable to load journals. <Button variant="link" onClick={() => setRetry((value) => value + 1)}>Retry journals</Button></p> : null}
        </div>
        {hasFilters ? <div aria-label="Active accounting filters" className="flex flex-wrap gap-2">
          {Object.entries({ query, balanced, status, view, startDate, endDate, journalId, exportStatus }).filter(([, value]) => value).map(([key, value]) =>
            <Button aria-label={`Remove ${key}: ${value}`} className="h-7 rounded-full text-xs" key={key} variant="outline" onClick={() => update({ [key]: null })}>{key}: {value}<X aria-hidden="true" className="size-3" /></Button>)}
        </div> : null}
        {content}
      </section>
      {creationIdentity === identity ? <AccountingEntryCreateSheet key={identity} onClose={() => setCreationIdentity(null)}
        onCreated={(record) => { setCreationIdentity(null); setRetry((value) => value + 1); update({ entry: String(record.entry.accountingEntryId) }, false) }}
        onOpenExisting={(id) => { setCreationIdentity(null); update({ entry: String(id) }, false) }} /> : null}
      {entryId !== null ? (
        <AccountingEntryDetails id={entryId} key={`${identity}:${entryId}`} onClose={() => update({ entry: null }, false)} />
      ) : null}
    </div>
  )
}
