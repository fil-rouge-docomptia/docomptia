import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Ellipsis, Upload } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { UploadPanel } from '@/components/invoice/UploadPanel'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import ForbiddenPage from '@/pages/ForbiddenPage'
import { ApiError } from '@/services/api'
import {
  isInvoiceOcrFailureResponse,
  retryInvoiceOcr,
  uploadInvoice,
} from '@/services/invoice'
import type { InvoiceUploadPhase } from '@/types/invoice'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
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

export default function InvoiceUploadPage() {
  const location = useLocation()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<InvoiceUploadPhase>('empty')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null)
  const [isForbidden, setIsForbidden] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(
    () => location.pathname === '/invoices/upload' || location.search === '?upload=1',
  )
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
            <Button onClick={() => setIsUploadOpen(true)} type="button">
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

      <UploadPanel
        createdInvoiceId={createdInvoiceId}
        errorMessage={errorMessage}
        isOpen={isUploadOpen}
        onFileChange={handleFileChange}
        onOpenChange={setIsUploadOpen}
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
