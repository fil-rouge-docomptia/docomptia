import { useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { getDocumentFileName } from '@/components/document/document-utils'
import { Button } from '@/components/ui/button'
import { getInvoiceFile } from '@/services/invoice'
import type { InvoiceListItem } from '@/types/invoice'

type DocumentActionsProps = {
  invoice: InvoiceListItem
}

export function DocumentActions({ invoice }: DocumentActionsProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadError(false)

    try {
      const blob = await getInvoiceFile(invoice.invoiceId)
      const fileUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = getDocumentFileName(invoice, blob)
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 0)
    } catch {
      setDownloadError(true)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button asChild className="px-2 text-primary" size="sm" variant="ghost">
        <Link aria-label={`Open document ${invoice.invoiceNumber ?? invoice.invoiceId}`} to={`/invoices/${invoice.invoiceId}`}>
          Open
        </Link>
      </Button>
      <Button
        aria-label={`Download document ${invoice.invoiceNumber ?? invoice.invoiceId}`}
        className="px-2 text-primary"
        disabled={downloading}
        onClick={() => void handleDownload()}
        size="sm"
        type="button"
        variant="ghost"
      >
        {downloading ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Download aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{downloading ? 'Downloading…' : 'Download'}</span>
      </Button>
      {downloadError ? (
        <span aria-live="polite" className="w-full text-right text-xs text-destructive">
          Download unavailable
        </span>
      ) : null}
    </div>
  )
}
