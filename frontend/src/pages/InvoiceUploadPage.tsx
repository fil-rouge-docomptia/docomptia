import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { ResultPanel } from '@/components/invoice/ResultPanel'
import { UploadPanel } from '@/components/invoice/UploadPanel'
import ForbiddenPage from '@/pages/ForbiddenPage'
import { ApiError } from '@/services/api'
import { uploadInvoice } from '@/services/invoice'
import type { InvoiceUploadResponse } from '@/types/invoice'

const acceptedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg']

export default function InvoiceUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isForbidden, setIsForbidden] = useState(false)
  const [uploadResponse, setUploadResponse] = useState<InvoiceUploadResponse | null>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (!acceptedMimeTypes.includes(file.type)) {
      setSelectedFile(null)
      setErrorMessage('Seuls les fichiers PDF, PNG, JPG et JPEG sont acceptes.')
      return
    }

    setErrorMessage('')
    setSelectedFile(file)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      setErrorMessage('Selectionne un fichier avant de lancer l analyse.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const data = await uploadInvoice(selectedFile, supplierId)
      setUploadResponse(data)
    } catch (error) {
      setUploadResponse(null)

      if (error instanceof ApiError && error.status === 403) {
        setIsForbidden(true)
      } else {
        setErrorMessage("L'envoi de la facture a échoué. Réessayez plus tard.")
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
        supplierId={supplierId}
        onSupplierIdChange={setSupplierId}
      />

      <ResultPanel uploadResponse={uploadResponse} />
    </div>
  )
}
