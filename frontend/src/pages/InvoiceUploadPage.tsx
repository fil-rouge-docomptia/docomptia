import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { ResultPanel } from '@/components/invoice/ResultPanel'
import { UploadPanel } from '@/components/invoice/UploadPanel'
import ForbiddenPage from '@/pages/ForbiddenPage'
import { ApiError } from '@/services/api'
import { uploadInvoice } from '@/services/invoice'
import type { InvoiceUploadResponse } from '@/types/invoice'

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isForbidden, setIsForbidden] = useState(false)
  const [uploadResponse, setUploadResponse] = useState<InvoiceUploadResponse | null>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setSelectedFile(null)
      setErrorMessage('')
      return
    }

    setSelectedFile(file)
    setUploadResponse(null)
    setErrorMessage(validateFile(file))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      setErrorMessage('Sélectionnez un fichier avant de lancer l’analyse.')
      return
    }

    const validationError = validateFile(selectedFile)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const data = await uploadInvoice(selectedFile)
      setUploadResponse(data)
    } catch (error) {
      setUploadResponse(null)

      if (error instanceof ApiError && error.status === 403) {
        setIsForbidden(true)
      } else {
        setErrorMessage(getUploadErrorMessage(error))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isForbidden) {
    return <ForbiddenPage />
  }

  return (
    <div className="grid w-full gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <UploadPanel
        errorMessage={errorMessage}
        isSubmitting={isSubmitting}
        onFileChange={handleFileChange}
        onSubmit={handleSubmit}
        selectedFile={selectedFile}
      />

      <ResultPanel uploadResponse={uploadResponse} />
    </div>
  )
}
