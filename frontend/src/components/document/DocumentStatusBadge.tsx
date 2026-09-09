import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'

export function DocumentStatusBadge({ status }: { status: string }) {
  const archived = status === 'ARCHIVEE'

  return (
    <InvoiceStatusBadge
      className={archived ? 'border-transparent bg-warning-muted text-warning-muted-foreground' : undefined}
      label={archived ? 'Archived — read only' : undefined}
      status={status}
    />
  )
}
