import { DocumentActions } from '@/components/document/DocumentActions'
import { DocumentPreview } from '@/components/document/DocumentPreview'
import { getDocumentName } from '@/components/document/document-utils'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { formatInvoiceMoney } from '@/components/invoice/detail/invoice-detail-utils'
import { Card, CardContent } from '@/components/ui/card'
import type { InvoiceListItem } from '@/types/invoice'

export function DocumentGrid({ documents }: { documents: InvoiceListItem[] }) {
  return (
    <div aria-label="Document preview grid" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {documents.map((invoice) => (
        <Card className="overflow-hidden shadow-elevation-1" key={invoice.invoiceId}>
          <div className="h-40 bg-muted p-2">
            <div className="h-full overflow-hidden rounded-md bg-background">
              <DocumentPreview invoice={invoice} />
            </div>
          </div>
          <CardContent className="space-y-3 p-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {getDocumentName(invoice)}
              </h2>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {invoice.supplierName ?? 'Unknown supplier'} · {formatInvoiceMoney(invoice.totalTtc, invoice.currencyCode)}
              </p>
            </div>
            <div className="flex items-start justify-between gap-2">
              <InvoiceStatusBadge status={invoice.status} />
              <DocumentActions invoice={invoice} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
