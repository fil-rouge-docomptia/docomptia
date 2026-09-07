import { DownloadExportButton } from '@/components/export/DownloadExportButton'
import { exportPeriod, exportStatusLabels, formatExportAmount, formatExportDate } from '@/components/export/export-utils'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExportBatch } from '@/types/export'

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
