import { formatInvoiceDate } from '@/components/invoice/detail/invoice-detail-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type ArchivedDocumentNoticeProps = {
  archivedAt?: string | null
  collection?: boolean
}

export function ArchivedDocumentNotice({
  archivedAt,
  collection = false,
}: ArchivedDocumentNoticeProps) {
  return (
    <Alert
      aria-label="Archived document notice"
      className="rounded-md border-0 bg-info-muted p-4 text-foreground shadow-none"
      role="status"
    >
      <AlertTitle className="mb-1.5 text-xs leading-4 tracking-[0.1px]">
        Archived — read only
      </AlertTitle>
      <AlertDescription className="space-y-2 text-xs leading-4">
        <p>
          {collection
            ? 'Archived documents are preserved for audit. Editing and workflow actions are disabled for these documents.'
            : 'This document is preserved for audit. Editing and workflow actions are disabled.'}
        </p>
        {archivedAt ? (
          <p>
            Archived on <time dateTime={archivedAt}>{formatInvoiceDate(archivedAt.split('T')[0])}</time>
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
