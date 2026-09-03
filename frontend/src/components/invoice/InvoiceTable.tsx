import type { KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  InvoiceListItem,
  InvoiceSortField,
  SortDirection,
} from '@/types/invoice'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
})

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function formatAmount(value: string | null, currencyCode: string | null) {
  if (!value) {
    return '—'
  }

  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return value
  }

  try {
    return new Intl.NumberFormat('en-GB', {
      currency: currencyCode || 'EUR',
      style: 'currency',
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currencyCode || 'EUR'}`
  }
}

type SortButtonProps = {
  activeDirection?: SortDirection
  children: string
  onClick: () => void
}

function SortButton({ activeDirection, children, onClick }: SortButtonProps) {
  const SortIcon = activeDirection === 'ASC'
    ? ArrowUp
    : activeDirection === 'DESC'
      ? ArrowDown
      : ArrowUpDown

  return (
    <Button
      className="-ml-3 h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      {children}
      <SortIcon aria-hidden="true" className="size-3.5" />
    </Button>
  )
}

type InvoiceTableProps = {
  direction: SortDirection
  getInvoiceHref?: (invoice: InvoiceListItem, index: number) => string
  invoices: InvoiceListItem[]
  onSortChange: (sortBy: InvoiceSortField) => void
  sortBy: InvoiceSortField
}

export function InvoiceTable({
  direction,
  getInvoiceHref,
  invoices,
  onSortChange,
  sortBy,
}: InvoiceTableProps) {
  const navigate = useNavigate()
  const activeDirection = (field: InvoiceSortField) =>
    sortBy === field ? direction : undefined
  const openInvoice = (invoice: InvoiceListItem, index: number) => {
    navigate(getInvoiceHref?.(invoice, index) ?? `/invoices/${invoice.invoiceId}`)
  }
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    invoice: InvoiceListItem,
    index: number,
  ) => {
    if (event.key === 'Enter') {
      openInvoice(invoice, index)
    }
  }

  return (
    <Table className="min-w-[820px]">
      <TableHeader className="bg-muted/70">
        <TableRow className="h-10 hover:bg-transparent">
          <TableHead className="h-10 px-4 text-xs">Invoice #</TableHead>
          <TableHead className="h-10 px-4 text-xs">Supplier</TableHead>
          <TableHead
            aria-sort={sortBy === 'invoiceDate' ? (direction === 'ASC' ? 'ascending' : 'descending') : 'none'}
            className="h-10 px-4 text-xs"
          >
            <SortButton
              activeDirection={activeDirection('invoiceDate')}
              onClick={() => onSortChange('invoiceDate')}
            >
              Invoice date
            </SortButton>
          </TableHead>
          <TableHead className="h-10 px-4 text-xs">Due date</TableHead>
          <TableHead
            aria-sort={sortBy === 'totalTtc' ? (direction === 'ASC' ? 'ascending' : 'descending') : 'none'}
            className="h-10 px-4 text-right text-xs"
          >
            <SortButton
              activeDirection={activeDirection('totalTtc')}
              onClick={() => onSortChange('totalTtc')}
            >
              Total
            </SortButton>
          </TableHead>
          <TableHead
            aria-sort={sortBy === 'status' ? (direction === 'ASC' ? 'ascending' : 'descending') : 'none'}
            className="h-10 px-4 text-xs"
          >
            <SortButton
              activeDirection={activeDirection('status')}
              onClick={() => onSortChange('status')}
            >
              Status
            </SortButton>
          </TableHead>
          <TableHead className="h-10 w-10 px-2">
            <span className="sr-only">Open invoice</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice, index) => (
          <TableRow
            aria-label={`Open invoice ${invoice.invoiceNumber || invoice.invoiceId}`}
            className="h-12 cursor-pointer focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            key={invoice.invoiceId}
            onClick={() => openInvoice(invoice, index)}
            onKeyDown={(event) => handleRowKeyDown(event, invoice, index)}
            role="link"
            tabIndex={0}
          >
            <TableCell className="h-12 px-4 py-2 font-medium">
              {invoice.invoiceNumber || '—'}
            </TableCell>
            <TableCell className="h-12 max-w-52 truncate px-4 py-2">
              {invoice.supplierName || '—'}
            </TableCell>
            <TableCell className="h-12 whitespace-nowrap px-4 py-2 text-muted-foreground">
              {formatDate(invoice.invoiceDate)}
            </TableCell>
            <TableCell className="h-12 whitespace-nowrap px-4 py-2 text-muted-foreground">
              {formatDate(invoice.dueDate)}
            </TableCell>
            <TableCell className="h-12 whitespace-nowrap px-4 py-2 text-right font-medium">
              {formatAmount(invoice.totalTtc, invoice.currencyCode)}
            </TableCell>
            <TableCell className="h-12 px-4 py-2">
              <InvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell className="h-12 px-2 py-2 text-muted-foreground">
              <ChevronRight aria-hidden="true" className="size-4" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
