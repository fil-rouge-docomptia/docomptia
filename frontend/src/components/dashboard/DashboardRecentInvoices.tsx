import { DashboardBlockError } from '@/components/dashboard/DashboardBlockError'
import {
  DashboardSectionAction,
  DashboardSectionHeader,
} from '@/components/dashboard/DashboardSectionHeader'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InvoiceListItem } from '@/types/invoice'

type DashboardRecentInvoicesProps = {
  error: boolean
  invoices: InvoiceListItem[] | null
  onRetry: () => void
}

function formatAmount(invoice: InvoiceListItem) {
  if (!invoice.totalTtc) {
    return '—'
  }

  const value = Number(invoice.totalTtc)
  if (!Number.isFinite(value)) {
    return invoice.totalTtc
  }

  return new Intl.NumberFormat('en-GB', {
    currency: invoice.currencyCode ?? 'EUR',
    style: 'currency',
  }).format(value)
}

export function DashboardRecentInvoices({
  error,
  invoices,
  onRetry,
}: DashboardRecentInvoicesProps) {
  return (
    <section aria-labelledby="dashboard-recent-invoices-title" className="min-w-0 max-w-full">
      <DashboardSectionHeader
        action={<DashboardSectionAction>View all</DashboardSectionAction>}
        description="Latest documents added to the workspace."
        title="Recent invoices"
        titleId="dashboard-recent-invoices-title"
      />
      <Card className="min-h-[204px] min-w-0 max-w-full overflow-hidden shadow-elevation-1">
        {error ? (
          <DashboardBlockError
            message="Recent invoices are unavailable."
            onRetry={onRetry}
          />
        ) : !invoices ? (
          <div aria-label="Loading recent invoices">
            <div className="h-10 bg-muted/70" />
            {Array.from({ length: 4 }, (_, index) => (
              <div className="grid h-[41px] grid-cols-4 items-center gap-4 border-b px-4 last:border-0" key={index}>
                {Array.from({ length: 4 }, (__, cellIndex) => (
                  <Skeleton className="h-4 w-full max-w-24" key={cellIndex} />
                ))}
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex min-h-[204px] items-center justify-center px-4 text-sm text-muted-foreground">
            No invoices in this workspace yet.
          </div>
        ) : (
          <Table className="min-w-[640px] text-xs">
            <TableHeader className="bg-muted/70">
              <TableRow className="hover:bg-muted/70">
                <TableHead className="h-10">Supplier</TableHead>
                <TableHead className="h-10">Invoice</TableHead>
                <TableHead className="h-10">Amount</TableHead>
                <TableHead className="h-10">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow className="h-[41px] hover:bg-transparent" key={invoice.invoiceId}>
                  <TableCell className="py-2 font-medium">{invoice.supplierName ?? 'Unknown supplier'}</TableCell>
                  <TableCell className="py-2">{invoice.invoiceNumber ?? 'Pending number'}</TableCell>
                  <TableCell className="py-2">{formatAmount(invoice)}</TableCell>
                  <TableCell className="py-0">
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  )
}
