import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, FileCheck2, LoaderCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExportLoadError } from '@/components/export/ExportLoadError'
import { ExportSelectionTable } from '@/components/export/ExportSelectionTable'
import { ExportTotals } from '@/components/export/ExportTotals'
import { exportPeriod, exportPeriodError, selectedExportTotals, validExportDate } from '@/components/export/export-utils'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { confirmExportSelection, getExportSelection } from '@/services/exports'
import type { ExportSelection } from '@/types/export'

const steps = ['Selection', 'Validation', 'Format', 'Confirmation']

export default function CreateExportPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const startDate = params.get('startDate') ?? ''
  const endDate = params.get('endDate') ?? ''
  const eligibility = ['ready', 'blocked'].includes(params.get('eligibility') ?? '') ? params.get('eligibility')! : 'all'
  const rawPage = Number(params.get('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage < 2147483647 ? rawPage : 1
  const update = (key: string, value: string) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    if (key !== 'page') next.delete('page')
    if (value) next.set(key, value); else next.delete(key)
    return next
  })
  return <SelectionWorkspace key={`${user?.id}:${user?.organization.id}:${user?.role.code}:${startDate}:${endDate}:${eligibility}`} startDate={startDate} endDate={endDate} eligibility={eligibility} page={page} update={update} />
}

function SelectionWorkspace({ startDate, endDate, eligibility, page, update }: {
  startDate: string; endDate: string; eligibility: string; page: number
  update: (key: string, value: string) => void
}) {
  const [retry, setRetry] = useState(0)
  const [load, setLoad] = useState<{ data: ExportSelection | null; error: unknown } | null>(null)
  const [selected, setSelected] = useState(new Set<number>())
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState<ExportSelection | null>(null)
  const [error, setError] = useState<{ message: string; blocked: boolean } | null>(null)
  const request = useRef<AbortController | null>(null)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const errorAlert = useRef<HTMLDivElement>(null)
  const periodError = exportPeriodError(startDate, endDate)
  const data = load?.data
  const filtered = (data?.invoices ?? []).filter((invoice) => eligibility === 'all' || invoice.eligible === (eligibility === 'ready'))
  const visible = filtered.slice((page - 1) * 8, page * 8)
  const selectedInvoices = (data?.invoices ?? []).filter((invoice) => invoice.eligible && selected.has(invoice.invoiceId))

  useEffect(() => {
    if (periodError) return
    const controller = new AbortController()
    getExportSelection(startDate, endDate, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setLoad({ data, error: null }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setLoad({ data: null, error }) })
    return () => controller.abort()
  }, [startDate, endDate, periodError, retry])
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { if (confirmation) resultHeading.current?.focus() }, [confirmation])
  useEffect(() => { if (error) errorAlert.current?.focus() }, [error])

  function reload() { setLoad(null); setSelected(new Set()); setRetry((value) => value + 1) }
  function toggle(ids: number[], checked: boolean) {
    setError(null)
    setSelected((previous) => {
      const next = new Set(previous)
      for (const id of ids) { if (checked) next.add(id); else next.delete(id) }
      return next
    })
  }
  async function confirm() {
    if (busy || request.current || selectedInvoices.length === 0 || error?.blocked) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    try {
      const result = await confirmExportSelection(startDate, endDate, selectedInvoices.map((invoice) => invoice.invoiceId), controller.signal)
      if (!controller.signal.aborted) setConfirmation(result)
    } catch (cause) {
      if (controller.signal.aborted) return
      const status = cause instanceof ApiError ? cause.status : null
      setError({ message: status === 409 ? 'Your selection has changed or no longer passes accounting controls. Review the refreshed invoices and select them again.' : status === 403 ? 'You do not have permission to confirm this selection.' : [404, 405, 501].includes(status ?? 0) ? 'Selection confirmation is not available yet.' : 'The selection could not be confirmed. Please try again.', blocked: [403, 404, 405, 501].includes(status ?? 0) })
      if (status === 409) reload()
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false) }
    }
  }

  return <div className="mx-auto min-w-0 max-w-[800px] space-y-6">
    <header className="space-y-5">
      <div><h1 className="text-2xl font-semibold tracking-tight">Create export</h1><p className="mt-2 text-sm text-muted-foreground">Step 1 of 4 · Selection</p></div>
      <ol aria-label="Export steps" className="grid grid-cols-4 gap-2">{steps.map((label, index) => <li aria-current={index === 0 ? 'step' : undefined} className="flex flex-col items-center gap-2 text-center text-xs sm:flex-row sm:text-left sm:text-sm" key={label}><span className={`flex size-8 shrink-0 items-center justify-center rounded-full border font-medium ${index === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{index + 1}</span><span className={index === 0 ? 'font-medium' : 'text-muted-foreground'}>{label}</span></li>)}</ol>
      <div aria-label="Export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={25} className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar"><div className="h-full w-1/4 rounded-full bg-primary" /></div>
    </header>
    {confirmation ? <>
      <Card className="space-y-5 p-6">
        <CheckCircle2 aria-hidden="true" className="size-8 text-primary" />
        <div><h2 className="text-lg font-semibold outline-none" ref={resultHeading} tabIndex={-1}>Selection prepared</h2><p className="mt-2 text-sm text-muted-foreground">Your selection has been checked. No export file has been generated.</p></div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Organization</dt><dd className="mt-1 font-medium">{confirmation.organizationName}</dd></div><div><dt className="text-muted-foreground">Invoice period (inclusive)</dt><dd className="mt-1 font-medium">{exportPeriod(confirmation.startDate, confirmation.endDate)}</dd></div></dl>
        <Badge variant="secondary">{confirmation.invoices.length} invoices selected</Badge>
        <ul className="max-h-48 space-y-1 overflow-auto text-sm" aria-label="Confirmed invoices">{confirmation.invoices.map((invoice) => <li key={invoice.invoiceId}>{invoice.invoiceNumber ?? `Invoice #${invoice.invoiceId}`}</li>)}</ul>
        <ExportTotals totals={confirmation.totals} />
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">Format validation and file generation will be available in the next steps. This selection is not saved when you leave this page.</p>
      </Card>
      <div className="flex flex-wrap justify-between gap-3"><Button className="h-11 sm:h-10" onClick={() => { setConfirmation(null); reload() }} variant="outline">Edit selection</Button><Button asChild className="h-11 sm:h-10"><Link to="/exports">Back to exports</Link></Button></div>
    </> : <>
      <Card className="space-y-4 p-6">
        <div><h2 className="text-base font-semibold">Select accounting entries</h2><p className="mt-2 text-sm text-muted-foreground">Choose the invoice period and the invoices used to prepare this export.</p></div>
        <fieldset className="grid min-w-0 gap-x-4 gap-y-3 sm:grid-cols-2" disabled={busy}>
          <legend className="sr-only">Selection period and scope</legend>
          <div><Label className="text-xs" htmlFor="selection-from">Invoice date from</Label><Input className="mt-2 h-11 sm:h-9" id="selection-from" type="date" value={validExportDate(startDate) ? startDate : ''} aria-invalid={Boolean(periodError)} aria-describedby={periodError ? 'selection-period-error' : undefined} onChange={(event) => update('startDate', event.target.value)} /></div>
          <div><Label className="text-xs" htmlFor="selection-through">Invoice date through</Label><Input className="mt-2 h-11 sm:h-9" id="selection-through" type="date" value={validExportDate(endDate) ? endDate : ''} aria-invalid={Boolean(periodError)} aria-describedby={periodError ? 'selection-period-error' : undefined} onChange={(event) => update('endDate', event.target.value)} /></div>
          <div><Label className="text-xs" htmlFor="selection-scope">Scope</Label><output className="mt-2 block min-h-11 break-words rounded-md border border-input px-3 py-2 text-sm sm:min-h-9" id="selection-scope">{data ? `${data.organizationName} · All invoices` : 'Current organization · All invoices'}</output></div>
          <div><Label className="text-xs" htmlFor="selection-status">Invoice status</Label><output className="mt-2 block min-h-11 rounded-md border border-input px-3 py-2 text-sm sm:min-h-9" id="selection-status">Exportable · Not previously exported</output></div>
        </fieldset>
        {periodError && <p className="text-sm text-destructive" id="selection-period-error" role="alert">{periodError}</p>}
        <p className="text-xs text-muted-foreground">{exportPeriod(validExportDate(startDate) ? startDate : null, validExportDate(endDate) ? endDate : null)} · Invoice dates are inclusive. Changing a filter clears the selection.</p>
        <div aria-live="polite" className="flex flex-wrap items-center gap-2"><Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">{selectedInvoices.length} invoices selected</Badge><span className="text-xs text-muted-foreground">Only eligible invoices can be selected</span></div>
        <ExportTotals totals={selectedExportTotals(selectedInvoices)} />
      </Card>
      {error && <Alert ref={errorAlert} tabIndex={-1} variant="destructive"><AlertTitle>Selection not confirmed</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>}
      {!periodError && <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><h2 className="text-sm font-semibold">Invoices in this period</h2><Select value={eligibility} disabled={busy} onValueChange={(value) => update('eligibility', value === 'all' ? '' : value)}><SelectTrigger aria-label="Invoice eligibility" className="h-11 w-44 sm:h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All candidates</SelectItem><SelectItem value="ready">Ready to export</SelectItem><SelectItem value="blocked">Blocked invoices</SelectItem></SelectContent></Select></div>
        {load?.error ? <div className="p-6"><ExportLoadError error={load.error} onRetry={reload} /></div> : !data ? <div aria-label="Loading eligible invoices" className="space-y-3 p-4" role="status"><span className="sr-only">Loading eligible invoices</span>{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-11" key={index} />)}</div> : visible.length === 0 ? <div className="space-y-3 p-8 text-center"><FileCheck2 aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><h3 className="font-semibold">{page > 1 ? 'No invoices on this page' : 'No matching invoices'}</h3><p className="text-sm text-muted-foreground">Choose another period or eligibility filter. Previously exported invoices are excluded.</p>{page > 1 && <Button onClick={() => update('page', '1')} variant="outline">Back to first page</Button>}</div> : <><ExportSelectionTable invoices={visible} selected={selected} disabled={busy || Boolean(error?.blocked)} onToggle={(id, checked) => toggle([id], checked)} onTogglePage={(checked) => toggle(visible.filter((invoice) => invoice.eligible).map((invoice) => invoice.invoiceId), checked)} /><SupplierPagination ariaLabel="Selection pagination" currentPage={page} itemLabel="invoices" onPageChange={(page) => update('page', String(page))} pageSize={8} totalElements={filtered.length} totalPages={Math.ceil(filtered.length / 8)} /></>}
      </Card>}
      <div className="flex items-center justify-between gap-3"><Button asChild className="h-11 sm:h-10" variant="outline"><Link to="/exports">Cancel</Link></Button><Button className="h-11 sm:h-10" disabled={busy || Boolean(periodError) || !data || selectedInvoices.length === 0 || Boolean(error?.blocked)} onClick={() => void confirm()}>{busy ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Checking selection…</> : <>Continue<ArrowRight aria-hidden="true" /></>}</Button></div>
    </>}
  </div>
}
