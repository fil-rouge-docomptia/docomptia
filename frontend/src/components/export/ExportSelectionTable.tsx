import { Link } from 'react-router-dom'
import { formatExportAmount, formatExportDate } from '@/components/export/export-utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExportCandidate } from '@/types/export'

export function ExportSelectionTable({ invoices, selected, disabled, onToggle, onTogglePage }: {
  invoices: ExportCandidate[]
  selected: Set<number>
  disabled: boolean
  onToggle: (id: number, checked: boolean) => void
  onTogglePage: (checked: boolean) => void
}) {
  const eligible = invoices.filter((invoice) => invoice.eligible)
  const checked = eligible.filter((invoice) => selected.has(invoice.invoiceId)).length
  return <>
    <p className="px-4 py-2 text-xs text-muted-foreground sm:hidden">Scroll the table horizontally to view amounts and eligibility.</p>
    <Table aria-label="Invoices available for selection" className="min-w-[660px] text-xs">
    <TableHeader><TableRow className="bg-muted/40">
      <TableHead className="w-12 p-0"><Label className="flex size-11 items-center justify-center" htmlFor="select-export-page"><Checkbox id="select-export-page" aria-label="Select eligible invoices on this page" checked={checked > 0 && checked < eligible.length ? 'indeterminate' : eligible.length > 0 && checked === eligible.length} disabled={disabled || eligible.length === 0} onCheckedChange={(value) => onTogglePage(value === true)} /></Label></TableHead>
      {['Invoice', 'Date', 'Amount', 'Eligibility'].map((label) => <TableHead className="px-3 text-xs" key={label} scope="col">{label}</TableHead>)}
    </TableRow></TableHeader>
    <TableBody>{invoices.map((invoice) => <TableRow data-state={selected.has(invoice.invoiceId) ? 'selected' : undefined} key={invoice.invoiceId}>
      <TableCell className="p-0"><Label className="flex size-11 items-center justify-center" htmlFor={`export-invoice-${invoice.invoiceId}`}><Checkbox id={`export-invoice-${invoice.invoiceId}`} aria-label={`Select invoice ${invoice.invoiceNumber ?? invoice.invoiceId}`} checked={selected.has(invoice.invoiceId)} disabled={disabled || !invoice.eligible} onCheckedChange={(value) => onToggle(invoice.invoiceId, value === true)} /></Label></TableCell>
      <TableCell className="px-3 py-3"><Link className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:min-h-0" to={`/invoices/${invoice.invoiceId}`}>{invoice.invoiceNumber ?? `Invoice #${invoice.invoiceId}`}</Link>{invoice.supplierName && <p className="mt-1 text-muted-foreground">{invoice.supplierName}</p>}</TableCell>
      <TableCell className="whitespace-nowrap px-3 py-3">{formatExportDate(invoice.invoiceDate)}</TableCell>
      <TableCell className="whitespace-nowrap px-3 py-3 tabular-nums">{formatExportAmount(invoice.invoiceAmount, invoice.currencyCode)}</TableCell>
      <TableCell className="max-w-72 px-3 py-3"><Badge variant={invoice.eligible ? 'default' : 'destructive'}>{invoice.eligible ? 'Ready to export' : 'Blocked'}</Badge>{invoice.errors.length > 0 && <ul className="mt-2 space-y-1 text-xs text-destructive">{invoice.errors.map((error, index) => <li key={`${error.code}:${index}`}>{error.message}</li>)}</ul>}</TableCell>
    </TableRow>)}</TableBody>
  </Table></>
}
