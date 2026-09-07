import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ExportGenerationResult } from '@/components/export/ExportGenerationResult'
import type { ExportGenerationState } from '@/components/export/ExportGenerationResult'
import { ExportLoadError } from '@/components/export/ExportLoadError'
import { ExportStepper } from '@/components/export/ExportStepper'
import { ExportTotals } from '@/components/export/ExportTotals'
import { ExportValidationErrors } from '@/components/export/ExportValidationErrors'
import { exportPeriod, exportValidationErrors, formatExportAmount } from '@/components/export/export-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/api'
import { checkExportFormat, generateExport, getExportFormats } from '@/services/exports'
import type { ExportFormat, ExportPreflight, ExportSelection } from '@/types/export'

const descriptions = {
  FEC: 'French accounting file for audit and archival.',
  CSV: 'Accounting entries for spreadsheets, using the standard column layout.',
}

export function ExportReview({ selection, onEdit }: { selection: ExportSelection; onEdit: () => void }) {
  const [step, setStep] = useState<2 | 3 | 4>(2)
  const [formats, setFormats] = useState<{ data: ExportFormat[] | null; error: unknown } | null>(null)
  const [retry, setRetry] = useState(0)
  const [chosen, setChosen] = useState<ExportFormat | null>(null)
  const [checked, setChecked] = useState<ExportPreflight | null>(null)
  const [failure, setFailure] = useState<{ cause: unknown; message: string; blocked: boolean } | null>(null)
  const [generation, setGeneration] = useState<ExportGenerationState | null>(null)
  const [busy, setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorAlert = useRef<HTMLDivElement>(null)
  const format = chosen && formats?.data?.includes(chosen) ? chosen : null

  useEffect(() => { heading.current?.focus() }, [step])
  useEffect(() => { if (failure) errorAlert.current?.focus() }, [failure])
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    getExportFormats(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setFormats({ data, error: null }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setFormats({ data: null, error }) })
    return () => controller.abort()
  }, [retry])

  async function confirmFormat() {
    if (!format || busy || request.current || failure?.blocked) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setFailure(null)
    setChecked(null)
    try {
      const result = await checkExportFormat(selection, format, controller.signal)
      if (controller.signal.aborted) return
      if (result.format !== format || result.selection.organizationId !== selection.organizationId
        || result.selection.invoices.length !== selection.invoices.length
        || !selection.invoices.every((invoice) => result.selection.invoices.some((item) => item.invoiceId === invoice.invoiceId))) {
        throw new Error('The validated selection does not match the requested selection')
      }
      setChecked(result)
      setStep(4)
    } catch (cause) {
      if (controller.signal.aborted) return
      const status = cause instanceof ApiError ? cause.status : null
      const errors = exportValidationErrors(cause)
      const stale = status === 409 && (errors.length === 0 || errors.some((invoice) => invoice.errors.some((error) => error.code === 'SELECTION_CHANGED')))
      setFailure({ cause, blocked: stale || [400, 403, 404, 405, 501].includes(status ?? 0),
        message: stale ? 'Your selection has changed. Edit the selection and check the available invoices again.'
          : status === 409 ? `The selected invoices do not pass the ${format} accounting controls. Review each invoice and control below.`
          : status === 403 ? 'You do not have permission to validate this export.'
          : [404, 405, 501].includes(status ?? 0) ? 'Format validation is not available yet.'
          : status === 400 ? 'This export configuration is no longer accepted. Edit the selection to start again.'
          : 'The export could not be checked. Please try again.' })
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false) }
    }
  }

  async function generate() {
    if (!checked || generation || request.current) return
    const controller = new AbortController()
    request.current = controller
    setGeneration({ status: 'pending' })
    try {
      const receipt = await generateExport(checked.selection, checked.format, controller.signal)
      if (!controller.signal.aborted) setGeneration({ status: 'success', receipt })
    } catch (cause) {
      if (!controller.signal.aborted) setGeneration({ status: 'failure', cause })
    } finally {
      if (!controller.signal.aborted) request.current = null
    }
  }

  if (generation && checked) return <ExportGenerationResult state={generation} format={checked.format} onEdit={onEdit} />

  return <div className="mx-auto min-w-0 max-w-[800px] space-y-6">
    <ExportStepper step={step} />
    {step === 2 && <>
      <Card className="space-y-4 p-6">
        <div><h2 className="text-base font-semibold outline-none" ref={heading} tabIndex={-1}>Validate accounting data</h2><p className="mt-2 text-sm text-muted-foreground">{failure ? 'The latest validation did not succeed. Review the reported controls before continuing.' : `The server has checked the ${selection.invoices.length} selected invoices. Format-specific checks follow after you choose a format.`}</p></div>
        {!failure && <div className="mx-auto max-w-[560px] space-y-3">{[
          ['Invoice eligibility', 'Selected invoices are exportable and have not previously been exported.'],
          ['Accounting entries', 'Entries exist, have active accounts in this organization and balanced debit and credit totals.'],
          ['VAT totals', 'Invoice amounts and VAT totals are consistent.'],
        ].map(([title, description]) => <div className="rounded-lg border border-border p-4" key={title}><Alert className="rounded-md border-0 bg-green-50" role="status"><CheckCircle2 aria-hidden="true" className="size-4" /><AlertTitle className="text-sm">Passed — {title}</AlertTitle><AlertDescription className="text-sm text-muted-foreground">{description}</AlertDescription></Alert></div>)}</div>}
        {failure && <Alert variant="destructive"><AlertTitle>Export validation failed</AlertTitle><AlertDescription>{failure.message}<ExportValidationErrors invoices={exportValidationErrors(failure.cause)} /></AlertDescription></Alert>}
        <InvoiceList selection={selection} />
        <p className="text-xs text-muted-foreground">{failure ? 'No export file has been generated.' : 'Your selection has been checked. No export file has been generated.'}</p>
      </Card>
      <div className="flex justify-between gap-3"><Button className="h-11 sm:h-10" onClick={onEdit} variant="outline">Edit selection</Button><Button className="h-11 sm:h-10" onClick={() => setStep(3)}>Continue<ArrowRight aria-hidden="true" /></Button></div>
    </>}
    {step === 3 && <>
      <Card className="space-y-4 p-6">
        <div><h2 className="text-base font-semibold outline-none" ref={heading} tabIndex={-1}>Choose export format</h2><p className="mt-2 text-sm text-muted-foreground">Choose a supported format for the selected accounting entries.</p></div>
        {formats?.error ? <ExportLoadError error={formats.error} onRetry={() => { setFormats(null); setRetry((value) => value + 1) }} />
          : !formats?.data ? <div aria-label="Loading export formats" className="space-y-3" role="status"><span className="sr-only">Loading export formats</span><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          : formats.data.length === 0 ? <p className="rounded-md border p-4 text-sm text-muted-foreground" role="status">No supported export formats are available.</p>
          : <RadioGroup aria-label="Export format" value={format ?? ''} disabled={busy || Boolean(failure?.blocked)} onValueChange={(value) => { setChosen(value as ExportFormat); setChecked(null) }} className="gap-4">{(['FEC', 'CSV'] as const).filter((item) => formats.data?.includes(item)).map((item) => <label className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${format === item ? 'border-primary bg-green-50 ring-1 ring-primary' : 'border-border'} ${busy || failure?.blocked ? 'cursor-not-allowed opacity-60' : ''}`} htmlFor={`export-${item}`} key={item}>
            <RadioGroupItem className="mt-0.5 size-5 shrink-0" id={`export-${item}`} value={item} aria-label={item} aria-describedby={`export-${item}-description`} />
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item}</span><span className="mt-1 block text-xs leading-4 text-muted-foreground" id={`export-${item}-description`}>{descriptions[item]}</span>{item === 'CSV' && format === item && <span className="mt-3 block max-w-[420px] rounded-md border border-border bg-background px-3 py-2 text-sm">Standard CSV · Fixed accounting columns</span>}</span><Badge className="shrink-0" variant="outline">{item}</Badge>
          </label>)}</RadioGroup>}
        {format && <Alert className="rounded-md border-0 bg-blue-50" role="status"><AlertTitle className="text-sm">{format} selected</AlertTitle><AlertDescription className="text-muted-foreground">{format === 'FEC' ? 'The server will also check the legal identifier, required fields, account numbers and FEC line amounts.' : 'The server will recheck the selected invoices before displaying the final summary.'}</AlertDescription></Alert>}
      </Card>
      {failure && <Alert ref={errorAlert} tabIndex={-1} variant="destructive"><AlertTitle>Export validation failed</AlertTitle><AlertDescription>{failure.message}<ExportValidationErrors invoices={exportValidationErrors(failure.cause)} /><Button className="mt-4 h-11 sm:h-10" onClick={onEdit} variant="outline">Edit selection</Button></AlertDescription></Alert>}
      <div className="flex justify-between gap-3"><Button className="h-11 sm:h-10" disabled={busy} onClick={() => setStep(2)} variant="outline">Back</Button><Button className="h-11 sm:h-10" disabled={!format || busy || Boolean(failure?.blocked)} onClick={() => void confirmFormat()}>{busy ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Checking format…</> : <>Continue<ArrowRight aria-hidden="true" /></>}</Button></div>
    </>}
    {step === 4 && checked && <>
      <Card className="space-y-4 p-6">
        <div><h2 className="text-base font-semibold outline-none" ref={heading} tabIndex={-1}>Confirm export generation</h2><p className="mt-2 text-sm text-muted-foreground">Review the configuration checked by the server.</p></div>
        <dl className="divide-y divide-border text-sm">{[
          ['Invoice period', exportPeriod(checked.selection.startDate, checked.selection.endDate)],
          ['Organization', checked.selection.organizationName],
          ['Invoices selected', String(checked.selection.invoices.length)],
          ['Validation', 'Passed · No blocking errors'],
          ['Format', checked.format],
          ['Total invoice amount', checked.selection.totals.map((total) => formatExportAmount(total.invoiceAmount, total.currencyCode)).join(' · ')],
        ].map(([label, value]) => <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-2" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words font-medium sm:max-w-[65%] sm:text-right">{value}</dd></div>)}</dl>
        <ExportTotals totals={checked.selection.totals} />
        <InvoiceList selection={checked.selection} />
        <Alert className="rounded-md border-0 bg-green-50" role="status"><AlertTitle className="text-sm">Export configuration checked</AlertTitle><AlertDescription className="text-muted-foreground">The selected invoices passed the {checked.format} controls. No export file has been generated and no invoice has been modified.</AlertDescription></Alert>
        <p className="text-sm text-muted-foreground" id="generation-effects">Generating stores the file and marks the selected invoices as exported after the server succeeds. This selection is not saved when you leave the page.</p>
      </Card>
      <div className="flex justify-between gap-3"><Button className="h-11 sm:h-10" onClick={() => { setChecked(null); setStep(3) }} variant="outline">Back</Button><Button className="h-11 sm:h-10" aria-describedby="generation-effects" onClick={() => void generate()}>Generate export</Button></div>
    </>}
    <p className="text-center text-sm"><Link className="text-muted-foreground underline underline-offset-4" to="/exports">Back to exports</Link></p>
  </div>
}

function InvoiceList({ selection }: { selection: ExportSelection }) {
  return <details className="rounded-md border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">{selection.invoices.length} invoices selected</summary><ul aria-label="Confirmed invoices" className="mt-3 max-h-40 space-y-1 overflow-auto">{selection.invoices.map((invoice) => <li className="break-words" key={invoice.invoiceId}>{invoice.invoiceNumber || `Invoice #${invoice.invoiceId}`}</li>)}</ul></details>
}
