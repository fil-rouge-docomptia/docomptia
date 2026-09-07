import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'

import { getDocumentTypeLabel } from '@/components/document/document-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/api'
import { getInvoicePreview } from '@/services/invoice'
import type { InvoiceListItem } from '@/types/invoice'

type PreviewState = {
  error: 'forbidden' | 'unavailable' | null
  mimeType: string
  url: string
}

export function DocumentPreview({ invoice }: { invoice: InvoiceListItem }) {
  const [preview, setPreview] = useState<PreviewState | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''

    getInvoicePreview(invoice.invoiceId, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setPreview({ error: null, mimeType: blob.type, url: objectUrl })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setPreview({
            error: requestError instanceof ApiError && requestError.status === 403 ? 'forbidden' : 'unavailable',
            mimeType: '',
            url: '',
          })
        }
      })

    return () => {
      controller.abort()
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [invoice.invoiceId])

  if (!preview) {
    return <Skeleton aria-label="Loading document preview" className="h-full w-full" />
  }

  if (preview.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted text-muted-foreground">
        <FileText aria-hidden="true" className="size-6" />
        <span className="mt-2 text-xs">
          {preview.error === 'forbidden' ? 'You do not have permission to preview this document.' : 'Preview unavailable'}
        </span>
      </div>
    )
  }

  if (preview.mimeType.startsWith('image/')) {
    return (
      <img
        alt={`Preview of ${invoice.invoiceNumber ?? `invoice ${invoice.invoiceId}`}`}
        className="h-full w-full object-cover"
        src={preview.url}
      />
    )
  }

  if (preview.mimeType === 'application/pdf') {
    return (
      <object
        aria-label={`Preview of ${invoice.invoiceNumber ?? `invoice ${invoice.invoiceId}`}`}
        className="pointer-events-none h-full w-full"
        data={`${preview.url}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        type="application/pdf"
      >
        <FileText aria-hidden="true" />
      </object>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-muted text-muted-foreground">
      <FileText aria-hidden="true" className="size-6" />
      <span className="mt-2 text-xs">{getDocumentTypeLabel(preview.mimeType)}</span>
    </div>
  )
}
