import { Ellipsis, ArrowDown, ArrowUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { formatInvoiceDate, formatInvoiceMoney } from '@/components/invoice/detail/invoice-detail-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { entryTypeLabels, entryExportLabel, type EntryColumn } from './accounting-utils'
import type { AccountingEntryRecord } from '@/types/accounting'

export function EntryBalanceBadge({ balanced, needsAttention }: { balanced: boolean; needsAttention?: boolean }) {
  const attention = needsAttention ?? !balanced
  return <Badge className={attention ? 'border-warning/20 bg-warning-muted text-warning-muted-foreground' : 'border-success/20 bg-success-muted text-success'} variant="outline">
    {attention ? 'Needs attention' : balanced ? 'Balanced' : 'Unbalanced'}
  </Badge>
}

export function AccountingEntryTable({ records, compact, onOpen, hidden = [], sortBy = 'entryDate', direction = 'DESC', onSort }: {
  records: AccountingEntryRecord[]; compact: boolean; onOpen: (id: number) => void
  hidden?: EntryColumn[]; sortBy?: string; direction?: string; onSort?: (field: string) => void
}) {
  const shown = (key: EntryColumn) => !hidden.includes(key)
  const heading = (label: string, field: string) => <TableHead aria-sort={sortBy === field ? direction === 'ASC' ? 'ascending' : 'descending' : 'none'}>
    {onSort ? <button className="inline-flex items-center gap-1 rounded-sm py-2 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onSort(field)}>{label}{sortBy === field ? direction === 'ASC' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}</button> : label}
  </TableHead>
  return <div className="min-w-0 overflow-hidden rounded-lg border border-border">
    <Table aria-label="Accounting entries" className={`min-w-[1000px] text-xs [&_td]:px-3 [&_td]:whitespace-nowrap ${compact ? '[&_td]:py-2' : '[&_td]:py-4'}`}>
      <TableHeader className="bg-muted [&_th]:h-10 [&_th]:px-3"><TableRow>
        {heading('Entry', 'entryNumber')}{shown('supplier') ? heading('Supplier', 'supplierName') : null}{shown('date') ? heading('Entry date', 'entryDate') : null}
        {shown('journal') ? heading('Journal', 'journalCode') : null}{shown('type') ? <TableHead>Type</TableHead> : null}
        {shown('debit') ? <TableHead className="text-right">Debit</TableHead> : null}{shown('credit') ? <TableHead className="text-right">Credit</TableHead> : null}
        {shown('balance') ? <TableHead>Balance</TableHead> : null}{shown('export') ? <TableHead>Export status</TableHead> : null}
        {shown('invoiceStatus') ? <TableHead>Invoice status</TableHead> : null}{shown('invoice') ? heading('Invoice', 'invoiceNumber') : null}<TableHead>Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>{records.map((record) => {
        const { entry } = record
        return <TableRow key={entry.accountingEntryId} className={record.needsAttention ? 'bg-warning-muted/30' : ''}>
          <TableCell><button aria-label={`Open entry ${entry.entryNumber}`} className="rounded-sm text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring" id={`entry-${entry.accountingEntryId}`} onClick={() => onOpen(entry.accountingEntryId)}>{entry.entryNumber}</button></TableCell>
          {shown('supplier') ? <TableCell className="max-w-48 truncate" title={record.supplierName ?? undefined}>{record.supplierName || 'Not provided'}</TableCell> : null}
          {shown('date') ? <TableCell className="whitespace-nowrap text-muted-foreground">{formatInvoiceDate(entry.entryDate)}</TableCell> : null}
          {shown('journal') ? <TableCell>{record.journal ? <Badge title={record.journal.label} variant="outline">{record.journal.code}{record.journal.active ? '' : ' · inactive'}</Badge> : 'Not assigned'}</TableCell> : null}
          {shown('type') ? <TableCell><Badge variant="outline">{entryTypeLabels[entry.status] ?? entry.status}</Badge></TableCell> : null}
          {shown('debit') ? <TableCell className="whitespace-nowrap text-right tabular-nums">{formatInvoiceMoney(entry.totalDebit, record.currencyCode)}</TableCell> : null}
          {shown('credit') ? <TableCell className="whitespace-nowrap text-right tabular-nums">{formatInvoiceMoney(entry.totalCredit, record.currencyCode)}</TableCell> : null}
          {shown('balance') ? <TableCell><EntryBalanceBadge balanced={entry.balanced} needsAttention={record.needsAttention} /></TableCell> : null}
          {shown('export') ? <TableCell><Badge variant="outline">{entryExportLabel(record)}</Badge></TableCell> : null}
          {shown('invoiceStatus') ? <TableCell><InvoiceStatusBadge status={record.invoiceStatus} /></TableCell> : null}
          {shown('invoice') ? <TableCell><Link aria-label={`Open invoice ${record.invoiceNumber ?? record.invoiceId}`} className="whitespace-nowrap text-primary hover:underline" to={`/invoices/${record.invoiceId}`}>{record.invoiceNumber ?? 'View invoice'}</Link></TableCell> : null}
          <TableCell><div className="flex items-center gap-1">
            {record.needsAttention ? <Button className="text-xs" size="sm" variant="outline" onClick={() => onOpen(entry.accountingEntryId)}>Review issue</Button> : null}
            <DropdownMenu><DropdownMenuTrigger asChild><Button aria-label={`Actions for ${entry.entryNumber}`} variant="ghost" size="icon"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onOpen(entry.accountingEntryId)}>Open entry</DropdownMenuItem><DropdownMenuItem asChild><Link to={`/invoices/${record.invoiceId}`}>Open invoice</Link></DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </div></TableCell>
        </TableRow>
      })}</TableBody>
    </Table>
  </div>
}
