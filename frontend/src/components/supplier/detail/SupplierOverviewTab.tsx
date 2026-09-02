import { useEffect, useState } from 'react'
import { AlertCircle, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { formatInvoiceDate, formatInvoiceMoney } from '@/components/invoice/detail/invoice-detail-utils'
import { formatSupplierDate } from '@/components/supplier/detail/supplier-detail-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listSupplierInvoices } from '@/services/supplier'
import type { InvoicePage } from '@/types/invoice'
import type { SupplierDetails } from '@/types/supplier'

type SupplierOverviewTabProps = {
  onViewInvoices: () => void
  supplier: SupplierDetails
}

export function SupplierOverviewTab({ onViewInvoices, supplier }: SupplierOverviewTabProps) {
  const [invoicePage, setInvoicePage] = useState<InvoicePage | null>(null)
  const [invoiceError, setInvoiceError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    listSupplierInvoices(
      supplier.supplierId,
      { direction: 'DESC', page: 0, size: 4, sortBy: 'invoiceDate' },
      controller.signal,
    )
      .then((response) => {
        setInvoicePage(response)
        setInvoiceError(false)
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setInvoiceError(true)
        }
      })

    return () => controller.abort()
  }, [supplier.supplierId])

  const metrics = [
    {
      label: 'Invoice volume',
      value: invoiceError ? '—' : invoicePage?.totalElements.toLocaleString('en-GB') ?? null,
    },
    {
      label: 'Legal identifiers',
      value: supplier.currentLegalIdentifiers.length.toLocaleString('en-GB'),
    },
    { label: 'Country', value: supplier.countryCode || 'Not provided' },
    { label: 'Last updated', value: formatSupplierDate(supplier.updatedAt) },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card className="shadow-elevation-1" key={metric.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              {metric.value === null ? (
                <Skeleton className="mt-2 h-8 w-28" />
              ) : (
                <p className="mt-2 text-2xl font-semibold tracking-[-0.5px] text-foreground">
                  {metric.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-elevation-1">
        <CardHeader className="flex-row items-start justify-between space-y-0 p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recent invoices</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest invoices received from {supplier.legalName}.
            </p>
          </div>
          <Button onClick={onViewInvoices} size="sm" type="button" variant="ghost">
            View all
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {invoiceError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Unable to load recent invoices</AlertTitle>
              <AlertDescription>The supplier profile remains available.</AlertDescription>
            </Alert>
          ) : !invoicePage ? (
            <div aria-label="Loading recent invoices" className="space-y-3 py-2">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : invoicePage.content.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <FileText aria-hidden="true" className="size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No invoice linked yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Linked invoices will appear in this overview.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 px-2 text-xs">Invoice #</TableHead>
                  <TableHead className="h-10 px-2 text-xs">Invoice date</TableHead>
                  <TableHead className="h-10 px-2 text-right text-xs">Total</TableHead>
                  <TableHead className="h-10 px-2 text-xs">Status</TableHead>
                  <TableHead className="h-10 px-2 text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicePage.content.map((invoice) => (
                  <TableRow key={invoice.invoiceId}>
                    <TableCell className="px-2 py-2 text-xs font-medium">
                      {invoice.invoiceNumber || '—'}
                    </TableCell>
                    <TableCell className="px-2 py-2 text-xs text-muted-foreground">
                      {formatInvoiceDate(invoice.invoiceDate)}
                    </TableCell>
                    <TableCell className="px-2 py-2 text-right text-xs font-medium">
                      {formatInvoiceMoney(invoice.totalTtc, invoice.currencyCode)}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="px-2 py-2 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link aria-label={`Open invoice ${invoice.invoiceNumber || invoice.invoiceId}`} to={`/invoices/${invoice.invoiceId}`}>
                          Open
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
