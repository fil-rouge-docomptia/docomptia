import { Link } from 'react-router-dom'

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { formatInvoiceDate, formatInvoiceMoney } from '@/components/invoice/detail/invoice-detail-utils'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { entryTypeLabels } from './accounting-utils'
import type { AccountingEntryRecord } from '@/types/accounting'

export function EntryBalanceBadge({ balanced }: { balanced: boolean }) {
  return <Badge className={balanced ? 'border-success/20 bg-success-muted text-success' : 'border-warning/20 bg-warning-muted text-warning-muted-foreground'} variant="outline">
    {balanced ? 'Balanced' : 'Needs attention'}
  </Badge>
}

export function AccountingEntryTable({ records, compact, onOpen }: {
  records: AccountingEntryRecord[]
  compact: boolean
  onOpen: (id: number) => void
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border">
      <Table aria-label="Accounting entries" className={`min-w-[1000px] text-xs [&_td]:px-3 ${compact ? '[&_td]:py-2' : '[&_td]:py-4'}`}>
        <TableHeader className="bg-muted [&_th]:h-10 [&_th]:px-3">
          <TableRow>
            <TableHead>Entry</TableHead><TableHead>Supplier</TableHead><TableHead>Entry date</TableHead>
            <TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
            <TableHead>Balance</TableHead><TableHead>Invoice status</TableHead><TableHead>Invoice</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map(({ entry, ...record }) => (
            <TableRow className="cursor-pointer" key={entry.accountingEntryId} onClick={(event) => {
              if (!(event.target as HTMLElement).closest('a,button')) onOpen(entry.accountingEntryId)
            }}>
              <TableCell>
                <button aria-label={`Open entry ${entry.entryNumber}`} className="rounded-sm text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring" id={`entry-${entry.accountingEntryId}`} onClick={() => onOpen(entry.accountingEntryId)}>
                  {entry.entryNumber}
                </button>
              </TableCell>
              <TableCell className="max-w-48 truncate" title={record.supplierName ?? undefined}>{record.supplierName || 'Not provided'}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatInvoiceDate(entry.entryDate)}</TableCell>
              <TableCell><Badge variant="outline">{entryTypeLabels[entry.status] ?? entry.status}</Badge></TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatInvoiceMoney(entry.totalDebit, record.currencyCode)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatInvoiceMoney(entry.totalCredit, record.currencyCode)}</TableCell>
              <TableCell><EntryBalanceBadge balanced={entry.balanced} /></TableCell>
              <TableCell><InvoiceStatusBadge status={record.invoiceStatus} /></TableCell>
              <TableCell><Link aria-label={`Open invoice ${record.invoiceNumber ?? record.invoiceId}`} className="whitespace-nowrap text-primary underline-offset-4 hover:underline" to={`/invoices/${record.invoiceId}`}>{record.invoiceNumber ?? 'View invoice'}</Link></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
