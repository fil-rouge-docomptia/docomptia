import { useEffect, useRef, useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import { exportPeriod, exportStatusLabels, formatExportAmount, formatExportDate } from '@/components/export/export-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/services/api'
import { downloadExport } from '@/services/exports'
import type { ExportBatch } from '@/types/export'

function DownloadExportButton({ batch }: { batch: ExportBatch }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function download() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    try {
      const blob = await downloadExport(batch.exportBatchId, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = batch.fileName ?? `export-${batch.exportBatchId}.${batch.format === 'FEC' ? 'txt' : 'csv'}`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof ApiError && cause.status === 403 ? 'Download access denied' : cause instanceof ApiError && cause.status === 404 ? 'Export file not found' : 'Download failed. Try again.')
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false) }
    }
  }
  return <div className="text-right">
    <Button aria-label={`Download export ${batch.exportBatchId}`} className="size-11 p-0 sm:size-10" disabled={!batch.downloadable || busy} onClick={() => void download()} title={batch.downloadable ? 'Download export' : 'No generated file available'} variant="ghost">
      {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
    </Button>
    {error && <p className="max-w-40 text-xs text-destructive" role="alert">{error}</p>}
  </div>
}

export function ExportHistoryTable({ batches }: { batches: ExportBatch[] }) {
  return <>
    <p className="px-4 py-2 text-xs text-muted-foreground xl:hidden">Scroll the table horizontally to view export details and downloads.</p>
    <Table className="min-w-[1000px] text-xs" aria-label="Export history">
    <TableHeader><TableRow className="bg-muted/40">
      {['Export ID', 'Created', 'Period', 'Format', 'Invoices', 'Amount', 'Created by', 'Status', 'Actions'].map((label) => <TableHead className="h-10 px-3 text-xs" key={label} scope="col">{label}</TableHead>)}
    </TableRow></TableHeader>
    <TableBody>{batches.map((batch) => <TableRow key={batch.exportBatchId}>
      <TableCell className="px-3 py-0 font-medium">#{batch.exportBatchId}</TableCell>
      <TableCell className="whitespace-nowrap px-3 py-0">{formatExportDate(batch.createdAt)}</TableCell>
      <TableCell className="px-3 py-0">{exportPeriod(batch.periodStartDate, batch.periodEndDate)}</TableCell>
      <TableCell className="px-3 py-0">{batch.format}</TableCell>
      <TableCell className="px-3 py-0 tabular-nums">{batch.invoiceCount}</TableCell>
      <TableCell className="whitespace-nowrap px-3 py-0 tabular-nums">{batch.amounts.length ? batch.amounts.map((amount) => <div key={amount.currencyCode ?? 'unspecified'}>{formatExportAmount(amount.amount, amount.currencyCode)}</div>) : '—'}</TableCell>
      <TableCell className="px-3 py-0">{batch.createdByName}</TableCell>
      <TableCell className="px-3 py-0"><Badge className="whitespace-nowrap text-[11px]" variant={batch.status === 'GENERE' ? 'default' : 'secondary'}>{exportStatusLabels[batch.status] ?? batch.status}</Badge></TableCell>
      <TableCell className="px-3 py-0"><DownloadExportButton batch={batch} /></TableCell>
    </TableRow>)}</TableBody>
  </Table></>
}
