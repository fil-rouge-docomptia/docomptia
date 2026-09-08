import { useEffect, useRef } from 'react'
import { CheckCircle2, FileCheck2, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DownloadExportButton } from '@/components/export/DownloadExportButton'
import { ExportStepper } from '@/components/export/ExportStepper'
import { ExportValidationErrors } from '@/components/export/ExportValidationErrors'
import { exportValidationErrors } from '@/components/export/export-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/services/api'
import type { ExportFormat, ExportGenerationReceipt } from '@/types/export'

export type ExportGenerationState = { status: 'pending' }
  | { status: 'success'; receipt: ExportGenerationReceipt }
  | { status: 'failure'; cause: unknown }

export function ExportGenerationResult({ state, format, onEdit }: {
  state: ExportGenerationState; format: ExportFormat; onEdit: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [state.status])
  const receipt = state.status === 'success' ? state.receipt : null
  const cause = state.status === 'failure' ? state.cause : null
  const status = cause instanceof ApiError ? cause.status : null
  const rejected = [400, 403, 404, 405, 409, 501].includes(status ?? 0)
  const failureMessage = status === 409 ? 'The selection has changed or failed accounting controls. Review the invoices and select them again.'
    : status === 403 ? 'You do not have permission to generate this export.'
    : [404, 405, 501].includes(status ?? 0) ? 'Export generation is not available. Please try again when the service is available.'
    : status === 400 ? 'The export configuration was rejected. Edit the selection and check it again.'
    : 'The server result could not be confirmed. The export may have completed. Check export history before starting again.'
  const title = state.status === 'pending' ? 'Generating export…' : receipt ? 'Export generated'
    : rejected ? 'Export generation failed' : 'Export result not confirmed'

  return <div className="mx-auto min-w-0 max-w-[800px] space-y-6">
    <ExportStepper step={4} />
    <Card className="space-y-5 px-6 py-8">
      <h2 className="text-lg font-semibold leading-7 outline-none" ref={heading} tabIndex={-1}>{title}</h2>
      {state.status === 'pending' && <>
        <p className="text-sm text-muted-foreground">Docomptia is preparing your {format} file.</p>
        <Progress aria-label="Export generation progress" className="h-2 bg-muted [&>div]:w-1/3 [&>div]:!transform-none motion-safe:[&>div]:animate-pulse" />
        <Alert className="min-h-[84px] rounded-md border-0 bg-blue-50 p-4" role="status">
          <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
          <AlertTitle className="mb-1.5 text-xs leading-4 tracking-[0.1px]">Building {format} export</AlertTitle>
          <AlertDescription className="text-xs leading-4">Checking the selected invoices and preparing the accounting file. Please wait for confirmation.</AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">Leaving this page does not cancel generation. Check export history before starting another export.</p>
      </>}
      {receipt && <>
        <p className="text-sm text-muted-foreground">Your accounting file is ready to download.</p>
        <Alert className="min-h-[84px] rounded-md border-0 bg-green-50 p-4" role="status">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          <AlertTitle className="mb-1.5 text-xs leading-4 tracking-[0.1px]">Export #{receipt.exportBatchId} generated successfully</AlertTitle>
          <AlertDescription className="text-xs leading-4">{receipt.invoiceIds.length} {receipt.invoiceIds.length === 1 ? 'invoice' : 'invoices'} exported · {receipt.format} · Created by {receipt.createdByName}</AlertDescription>
        </Alert>
        <div aria-label="Generated file" className="flex min-h-16 flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-lg border border-border p-3">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium"><FileCheck2 aria-hidden="true" className="size-4 shrink-0" /><span className="break-all">{receipt.fileName}</span></p>
          <p className="text-xs text-muted-foreground">{new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(receipt.fileSize / 1024)} KB · Generated {new Date(receipt.generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </>}
      {state.status === 'failure' && <>
        <p className="text-sm text-muted-foreground">{rejected ? 'No file was created by this request.' : 'Check the outcome in export history.'}</p>
        <Alert variant="destructive" className="min-h-[84px] rounded-md border-0 bg-destructive p-4 text-destructive-foreground">
          <AlertTitle className="mb-1.5 text-xs leading-4 tracking-[0.1px]">{rejected ? 'Unable to generate the export' : 'Generation outcome unknown'}</AlertTitle>
          <AlertDescription className="text-xs leading-4">{failureMessage}</AlertDescription>
        </Alert>
        <ExportValidationErrors invoices={exportValidationErrors(cause)} />
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
          <span className="min-w-0 break-all">{cause instanceof ApiError && cause.code ? `Error code · ${cause.code}` : status ? `HTTP ${status}` : 'No reliable server response'}</span>
          <span>{rejected ? 'No invoice was changed by this request.' : 'Invoice statuses have not been confirmed.'}</span>
        </div>
      </>}
    </Card>
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      {receipt ? <>
        <Button className="h-11 sm:h-10" onClick={onEdit} variant="outline">Create another export</Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 sm:h-10" variant="outline"><Link to={`/exports?query=${receipt.exportBatchId}#export-history`}>View export</Link></Button>
          <DownloadExportButton batch={{ ...receipt, downloadable: true }} showLabel />
        </div>
      </> : <>
        <Button asChild className="h-11 sm:h-10" variant="outline"><Link to="/exports">{state.status === 'pending' ? 'Back to exports' : 'View export history'}</Link></Button>
        {state.status === 'failure' && (status === 400 || status === 409) && <Button className="h-11 sm:h-10" onClick={onEdit}>Edit selection</Button>}
      </>}
    </div>
  </div>
}
