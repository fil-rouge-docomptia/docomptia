import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Ellipsis, Upload } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { InboxInvoiceList } from '@/components/invoice/InboxInvoiceList'
import { InboxToolbar } from '@/components/invoice/InboxToolbar'
import { UploadPanel } from '@/components/invoice/UploadPanel'
import {
  getInboxStatuses,
  parseInboxView,
  type InboxView,
} from '@/components/invoice/inbox-filter'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import ForbiddenPage from '@/pages/ForbiddenPage'
import { ApiError } from '@/services/api'
import {
  isInvoiceOcrFailureResponse,
  listInvoices,
  retryInvoiceOcr,
  uploadInvoice,
} from '@/services/invoice'
import type {
  InvoicePage,
  InvoiceSortField,
  InvoiceUploadPhase,
  SortDirection,
} from '@/types/invoice'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const PAGE_SIZE = 8
const sortableFields: InvoiceSortField[] = ['createdAt', 'invoiceDate', 'totalTtc', 'status']
const acceptedFileTypes = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  png: 'image/png',
} as const

const emptyFileMessage = 'Le fichier sélectionné est vide.'
const fileSizeMessage = 'Le fichier ne doit pas dépasser 10 Mo.'
const fileTypeMessage = 'Seuls les fichiers PDF, PNG, JPG et JPEG sont acceptés.'
const fileContentMessage = 'Le contenu du fichier ne correspond pas à son extension.'

function validateFile(file: File) {
  if (file.size === 0) {
    return emptyFileMessage
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return fileSizeMessage
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  const expectedMimeType = extension
    ? acceptedFileTypes[extension as keyof typeof acceptedFileTypes]
    : undefined

  if (!expectedMimeType || file.type.toLowerCase() !== expectedMimeType) {
    return fileTypeMessage
  }

  return ''
}

function getUploadErrorMessage(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== 'INVALID_INVOICE_FILE') {
    return "L'envoi de la facture a échoué. Réessayez plus tard."
  }

  const message = error.message.toLowerCase()

  if (message.includes('empty')) {
    return emptyFileMessage
  }

  if (message.includes('maximum allowed size')) {
    return fileSizeMessage
  }

  if (message.includes('supported file types') || message.includes('mime type')) {
    return fileTypeMessage
  }

  if (message.includes('content') || message.includes('read')) {
    return fileContentMessage
  }

  return 'Le fichier sélectionné n’a pas pu être validé.'
}

function parsePage(value: string | null) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function parseSortField(value: string | null): InvoiceSortField {
  return sortableFields.includes(value as InvoiceSortField)
    ? value as InvoiceSortField
    : 'createdAt'
}

function parseDirection(value: string | null): SortDirection {
  return value?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

type InboxRequestState = {
  error: boolean
  invoicePage: InvoicePage | null
  requestKey: string
}

export default function InvoiceUploadPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<InvoiceUploadPhase>('empty')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null)
  const [isForbidden, setIsForbidden] = useState(false)
  const [listRetryCount, setListRetryCount] = useState(0)
  const [inboxState, setInboxState] = useState<InboxRequestState>({
    error: false,
    invoicePage: null,
    requestKey: '',
  })
  const view = parseInboxView(searchParams.get('view'))
  const currentPage = parsePage(searchParams.get('page'))
  const sortBy = parseSortField(searchParams.get('sortBy'))
  const direction = parseDirection(searchParams.get('direction'))
  const invoiceNumber = searchParams.get('invoiceNumber')?.trim() ?? ''
  const supplier = searchParams.get('supplier')?.trim() ?? ''
  const statuses = useMemo(() => getInboxStatuses(view), [view])
  const requestKey = `${currentPage}:${sortBy}:${direction}:${invoiceNumber}:${supplier}:${statuses.join(',')}:${listRetryCount}`
  const isCurrentRequest = inboxState.requestKey === requestKey
  const invoicePage = isCurrentRequest ? inboxState.invoicePage : null
  const listError = isCurrentRequest && inboxState.error
  const isUploadOpen = searchParams.get('upload') === '1'
  const hasActiveFilters = view !== 'all' || Boolean(invoiceNumber || supplier)

  useEffect(() => {
    const controller = new AbortController()

    listInvoices(
      {
        direction,
        invoiceNumber: invoiceNumber || undefined,
        page: currentPage - 1,
        size: PAGE_SIZE,
        sortBy,
        status: statuses,
        supplier: supplier || undefined,
      },
      controller.signal,
    )
      .then((nextPage) => setInboxState({
        error: false,
        invoicePage: nextPage,
        requestKey,
      }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setInboxState({ error: true, invoicePage: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [currentPage, direction, invoiceNumber, requestKey, sortBy, statuses, supplier])

  const updateListParams = (updates: Record<string, string>) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          nextParams.set(key, value)
        } else {
          nextParams.delete(key)
        }
      })
      nextParams.set('page', '1')

      return nextParams
    })
  }

  const handleViewChange = (nextView: InboxView) => {
    updateListParams({ view: nextView === 'all' ? '' : nextView })
  }

  const handleSortChange = (field: InvoiceSortField) => {
    const nextDirection = sortBy === field && direction === 'DESC' ? 'ASC' : 'DESC'
    updateListParams({ direction: nextDirection, sortBy: field })
  }

  const handlePageChange = (page: number) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.set('page', String(page))
      return nextParams
    })
  }

  const handleClearFilters = () => {
    updateListParams({ invoiceNumber: '', supplier: '', view: '' })
  }

  const handleUploadOpenChange = (open: boolean) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      if (open) {
        nextParams.set('upload', '1')
      } else {
        nextParams.delete('upload')
      }
      return nextParams
    })
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setSelectedFile(null)
      setPhase('empty')
      setUploadProgress(0)
      setErrorMessage('')
      return
    }

    const validationError = validateFile(file)
    setSelectedFile(file)
    setCreatedInvoiceId(null)
    setUploadProgress(0)
    setErrorMessage(validationError)
    setPhase(validationError ? 'upload-error' : 'queued')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      setErrorMessage('Sélectionnez un fichier avant de lancer l’analyse.')
      setPhase('upload-error')
      return
    }

    const validationError = validateFile(selectedFile)
    if (validationError) {
      setErrorMessage(validationError)
      setPhase('upload-error')
      return
    }

    setPhase('uploading')
    setUploadProgress(0)
    setErrorMessage('')

    try {
      const data = await uploadInvoice(selectedFile, {
        onUploadComplete: () => setPhase('ocr-processing'),
        onUploadProgress: setUploadProgress,
      })
      setCreatedInvoiceId(data.invoiceId)
      setPhase('completed')
      setListRetryCount((count) => count + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setIsForbidden(true)
      } else if (
        error instanceof ApiError &&
        isInvoiceOcrFailureResponse(error.details)
      ) {
        setCreatedInvoiceId(error.details.invoiceId)
        setPhase('ocr-error')
      } else {
        setErrorMessage(getUploadErrorMessage(error))
        setPhase('upload-error')
      }
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setCreatedInvoiceId(null)
    setPhase('empty')
    setUploadProgress(0)
    setErrorMessage('')
  }

  const handleRetryOcr = async () => {
    if (!createdInvoiceId) {
      return
    }

    setPhase('ocr-processing')
    setErrorMessage('')

    try {
      await retryInvoiceOcr(createdInvoiceId)
      setPhase('completed')
      setListRetryCount((count) => count + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setIsForbidden(true)
      } else {
        setPhase('ocr-error')
      }
    }
  }

  if (isForbidden) {
    return <ForbiddenPage />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button className="hidden sm:inline-flex" type="button" variant="secondary">
              Import
            </Button>
            <Button onClick={() => handleUploadOpenChange(true)} type="button">
              <Upload aria-hidden="true" />
              Upload invoices
            </Button>
            <Button
              aria-label="More inbox actions"
              className="hidden bg-accent text-accent-foreground hover:bg-accent/80 sm:inline-flex"
              size="icon"
              type="button"
              variant="ghost"
            >
              <Ellipsis aria-hidden="true" />
            </Button>
          </>
        }
        description="Review incoming invoices and monitor OCR processing."
        title="Inbox"
      />

      <InboxToolbar
        invoiceNumber={invoiceNumber}
        onInvoiceNumberChange={(value) => updateListParams({ invoiceNumber: value })}
        onSupplierChange={(value) => updateListParams({ supplier: value })}
        onViewChange={handleViewChange}
        supplier={supplier}
        view={view}
      />

      <InboxInvoiceList
        direction={direction}
        error={listError}
        hasActiveFilters={hasActiveFilters}
        invoicePage={invoicePage}
        onClearFilters={handleClearFilters}
        onOpenUpload={() => handleUploadOpenChange(true)}
        onPageChange={handlePageChange}
        onRetry={() => setListRetryCount((count) => count + 1)}
        onSortChange={handleSortChange}
        sortBy={sortBy}
      />

      <UploadPanel
        createdInvoiceId={createdInvoiceId}
        errorMessage={errorMessage}
        isOpen={isUploadOpen}
        onFileChange={handleFileChange}
        onOpenChange={handleUploadOpenChange}
        onRemoveFile={handleRemoveFile}
        onRetryOcr={handleRetryOcr}
        onSubmit={handleSubmit}
        phase={phase}
        selectedFile={selectedFile}
        uploadProgress={uploadProgress}
      />
    </div>
  )
}
