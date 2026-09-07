import { useEffect, useState } from 'react'
import { ArrowRight, CircleAlert, FileCheck2, FileOutput, Plus, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExportHistoryTable } from '@/components/export/ExportHistoryTable'
import { ExportLoadError } from '@/components/export/ExportLoadError'
import { exportPeriodError, exportStatusLabels, validExportDate } from '@/components/export/export-utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getExportHistory, getExportSummary } from '@/services/exports'
import type { ExportHistory, ExportSummary } from '@/types/export'

export default function ExportsPage() {
  const { user } = useAuth()
  return <ExportCenter key={`${user?.id}:${user?.organization.id}:${user?.role.code}`} />
}

function ExportCenter() {
  const [params, setParams] = useSearchParams()
  const [retry, setRetry] = useState(0)
  const [summaryRetry, setSummaryRetry] = useState(0)
  const [summary, setSummary] = useState<{ data: ExportSummary | null; error: unknown } | null>(null)
  const query = (params.get('query') ?? '').slice(0, 200)
  const status = Object.hasOwn(exportStatusLabels, params.get('status') ?? '') ? params.get('status')! : ''
  const format = ['CSV', 'FEC'].includes(params.get('format') ?? '') ? params.get('format')! : ''
  const startDate = params.get('startDate') ?? ''
  const endDate = params.get('endDate') ?? ''
  const periodError = exportPeriodError(startDate, endDate)
  const rawPage = Number(params.get('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage < 2147483647 ? rawPage : 1
  const key = JSON.stringify([query, status, format, startDate, endDate, page, retry])
  const [result, setResult] = useState<{ key: string; data: ExportHistory | null; error: unknown } | null>(null)
  const current = result?.key === key ? result : null
  const data = current?.data
  const hasFilters = Boolean(query || status || format || startDate || endDate)

  useEffect(() => {
    const controller = new AbortController()
    getExportSummary(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setSummary({ data, error: null }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setSummary({ data: null, error }) })
    return () => controller.abort()
  }, [summaryRetry])

  useEffect(() => {
    if (periodError) return
    const controller = new AbortController()
    getExportHistory({ query: query.trim(), status, format, startDate, endDate, page: String(page - 1) }, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult({ key, data, error: null }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ key, data: null, error }) })
    return () => controller.abort()
  }, [query, status, format, startDate, endDate, page, key, periodError])

  const update = (updates: Record<string, string>, resetPage = true) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    if (resetPage) next.delete('page')
    for (const [key, value] of Object.entries(updates)) { if (value) next.set(key, value); else next.delete(key) }
    return next
  })

  const metrics = [
    { label: 'Ready to export', value: summary?.data?.readyToExport, description: 'Eligible invoices across all periods.', action: 'Open queue', href: '/exports/new?eligibility=ready', icon: FileCheck2 },
    { label: 'Exported this month', value: summary?.data?.exportedThisMonth, description: 'Batches generated this calendar month.', action: 'View exports', href: '/exports#export-history', icon: FileOutput },
    { label: 'Needs attention', value: summary?.data?.blockedInvoices, description: 'Invoices blocked by accounting controls.', action: 'Review invoices', href: '/exports/new?eligibility=blocked', icon: CircleAlert },
  ]

  return <div className="min-w-0 space-y-6">
    <PageHeader title="Exports" description="Prepare accounting exports and review generated files." actions={<Button asChild className="h-11 sm:h-10"><Link to="/exports/new"><Plus aria-hidden="true" />Create export</Link></Button>} />
    {summary?.error ? <ExportLoadError error={summary.error} onRetry={() => { setSummary(null); setSummaryRetry((value) => value + 1) }} /> : (
      <section aria-label="Export overview" className="grid gap-6 md:grid-cols-3">
        {metrics.map(({ label, value, description, action, href, icon: Icon }) => <Card className="flex min-h-[204px] flex-col gap-3 p-5" key={label}>
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon aria-hidden="true" className="size-4 text-muted-foreground" /></div>
          {value === undefined ? <Skeleton aria-label={`Loading ${label.toLowerCase()}`} className="h-7 w-14" /> : <p className="text-lg font-semibold tabular-nums">{value.toLocaleString('en-GB')}</p>}
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
          <Button asChild className="mt-auto h-11 justify-between sm:h-10"><Link to={href}>{action}<ArrowRight aria-hidden="true" /></Link></Button>
        </Card>)}
      </section>
    )}
    <Card className="min-w-0 overflow-hidden" id="export-history">
      <div className="border-b border-border px-6 py-4"><h2 className="text-base font-semibold">Export history</h2><p className="mt-1 text-xs text-muted-foreground">Review generated exports and retrieve their files.</p></div>
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
        <div className="min-w-40 flex-1"><Label className="sr-only" htmlFor="export-search">Search exports</Label><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="h-11 pl-9 sm:h-10" id="export-search" onChange={(event) => update({ query: event.target.value })} placeholder="Search exports" value={query} /></div></div>
        <Select value={status || 'all'} onValueChange={(value) => update({ status: value === 'all' ? '' : value })}><SelectTrigger aria-label="Export status" className="h-11 w-40 sm:h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(exportStatusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={format || 'all'} onValueChange={(value) => update({ format: value === 'all' ? '' : value })}><SelectTrigger aria-label="Export format" className="h-11 w-32 sm:h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All formats</SelectItem><SelectItem value="CSV">CSV</SelectItem><SelectItem value="FEC">FEC</SelectItem></SelectContent></Select>
        <div><Label className="text-xs" htmlFor="history-from">Created from</Label><Input className="mt-1 h-11 w-40 sm:h-10" id="history-from" type="date" value={validExportDate(startDate) ? startDate : ''} aria-invalid={Boolean(periodError)} onChange={(event) => update({ startDate: event.target.value })} /></div>
        <div><Label className="text-xs" htmlFor="history-to">Created through</Label><Input className="mt-1 h-11 w-40 sm:h-10" id="history-to" type="date" value={validExportDate(endDate) ? endDate : ''} aria-invalid={Boolean(periodError)} onChange={(event) => update({ endDate: event.target.value })} /></div>
        {hasFilters && <Button className="h-11 sm:h-10" onClick={() => setParams({})} variant="ghost">Clear filters</Button>}
      </div>
      {periodError ? <p className="p-6 text-sm text-destructive" role="alert">{periodError}</p> : current?.error ? <div className="p-6"><ExportLoadError error={current.error} onRetry={() => setRetry((value) => value + 1)} /></div> : !data ? (
        <div aria-label="Loading export history" className="space-y-3 p-4" role="status"><span className="sr-only">Loading export history</span>{Array.from({ length: 8 }, (_, index) => <Skeleton className="h-10" key={index} />)}</div>
      ) : data.content.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center"><FileOutput aria-hidden="true" className="size-8 text-muted-foreground" /><h3 className="font-semibold">{page > 1 ? 'No exports on this page' : hasFilters ? 'No matching exports' : 'No exports yet'}</h3><p className="text-sm text-muted-foreground">{hasFilters ? 'Try another search or clear your filters.' : 'Generated exports for your organization will appear here.'}</p>{page > 1 && <Button onClick={() => update({ page: '1' }, false)} variant="outline">Back to first page</Button>}</div>
      ) : <><ExportHistoryTable batches={data.content} /><SupplierPagination ariaLabel="Export pagination" currentPage={data.number + 1} itemLabel="exports" onPageChange={(page) => update({ page: String(page) }, false)} pageSize={data.size} totalElements={data.totalElements} totalPages={data.totalPages} /></>}
    </Card>
  </div>
}
