import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { AppNavbar } from '@/components/design-system/AppNavbar'
import { ResultPanel } from '@/components/invoice/ResultPanel'
import { UploadPanel } from '@/components/invoice/UploadPanel'
import { uploadInvoice } from '@/services/invoice'
import type { InvoiceUploadResponse } from '@/types/invoice'

const acceptedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg']

export default function InvoiceUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
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
      const data = await uploadInvoice(selectedFile)
      setUploadResponse(data)
    } catch (error) {
      setUploadResponse(null)
      setErrorMessage(error instanceof Error ? error.message : 'Une erreur inconnue est survenue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <AppNavbar />

      <main className="mx-auto grid w-full max-w-[1280px] gap-6 px-4 py-8 md:grid-cols-[40%_60%] md:px-8">
        <UploadPanel
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          onFileChange={handleFileChange}
          onSubmit={handleSubmit}
          selectedFile={selectedFile}
        />

        <ResultPanel uploadResponse={uploadResponse} />
      </main>
    </div>
  )
}
