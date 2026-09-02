import { FileText } from 'lucide-react'

import { DocumentActions } from '@/components/document/DocumentActions'
import { getDocumentName } from '@/components/document/document-utils'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import {
  formatInvoiceDate,
  formatInvoiceMoney,
} from '@/components/invoice/detail/invoice-detail-utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InvoiceListItem } from '@/types/invoice'

export function DocumentTable({ documents }: { documents: InvoiceListItem[] }) {
  return (
    <Table className="min-w-[760px]">
      <TableHeader className="bg-muted/70">
        <TableRow className="h-10 hover:bg-transparent">
          <TableHead className="h-10 w-14 px-4 text-xs">Preview</TableHead>
          <TableHead className="h-10 px-3 text-xs">Document</TableHead>
          <TableHead className="h-10 px-3 text-xs">Supplier</TableHead>
          <TableHead className="h-10 px-3 text-xs">Date</TableHead>
          <TableHead className="h-10 px-3 text-right text-xs">Amount</TableHead>
          <TableHead className="h-10 px-3 text-xs">Status</TableHead>
          <TableHead className="h-10 px-3 text-right text-xs">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((invoice) => (
          <TableRow className="h-14" key={invoice.invoiceId}>
            <TableCell className="px-4 py-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText aria-hidden="true" className="size-4" />
              </span>
            </TableCell>
            <TableCell className="max-w-56 px-3 py-2 text-xs font-medium">
              <span className="block truncate">{getDocumentName(invoice)}</span>
            </TableCell>
            <TableCell className="max-w-44 px-3 py-2 text-xs text-muted-foreground">
              <span className="block truncate">{invoice.supplierName ?? 'Not available'}</span>
            </TableCell>
            <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
              {formatInvoiceDate(invoice.invoiceDate)}
            </TableCell>
            <TableCell className="whitespace-nowrap px-3 py-2 text-right text-xs text-muted-foreground">
              {formatInvoiceMoney(invoice.totalTtc, invoice.currencyCode)}
            </TableCell>
            <TableCell className="px-3 py-2">
              <InvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell className="px-3 py-2">
              <DocumentActions invoice={invoice} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
