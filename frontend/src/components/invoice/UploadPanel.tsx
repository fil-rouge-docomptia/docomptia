import type { ChangeEvent, FormEvent } from 'react'
import { Plus, RotateCcw, Upload, X } from 'lucide-react'

import { UploadFileCard } from '@/components/invoice/UploadFileCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { InvoiceUploadPhase } from '@/types/invoice'

type UploadPanelProps = {
  createdInvoiceId: number | null
  errorMessage: string
  isOpen: boolean
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOpenChange: (open: boolean) => void
  onRemoveFile: () => void
  onRetryOcr: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  phase: InvoiceUploadPhase
  selectedFile: File | null
  uploadProgress: number
}

export function UploadPanel({
  createdInvoiceId,
  errorMessage,
  isOpen,
  onFileChange,
  onOpenChange,
  onRemoveFile,
  onRetryOcr,
  onSubmit,
  phase,
  selectedFile,
  uploadProgress,
}: UploadPanelProps) {
  const isBusy = phase === 'uploading' || phase === 'ocr-processing'
  const sheetState = {
    empty: 'Empty',
    queued: 'Queued',
    uploading: 'Uploading',
    'ocr-processing': 'OCR processing',
    completed: 'Completed',
    'upload-error': 'Upload error',
    'ocr-error': 'OCR processing failed',
  }[phase]
  const isError = phase === 'upload-error' || phase === 'ocr-error'

  const inputKey = selectedFile
    ? `${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`
    : 'empty'

  return (
    <Sheet onOpenChange={onOpenChange} open={isOpen}>
      <SheetContent
        className="flex h-dvh w-full max-w-full flex-col gap-0 border-border bg-popover p-0 shadow-elevation-3 sm:max-w-[560px] [&>button]:hidden"
        side="right"
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <SheetHeader className="flex h-[95px] shrink-0 flex-row items-center justify-between space-y-0 px-4 pl-6 text-left">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <SheetTitle className="min-w-0 truncate text-2xl font-semibold leading-8 tracking-[-0.5px]">
                  Upload invoices
                </SheetTitle>
                <Badge
                  className={cn(
                    'h-6 shrink-0 border-0 px-2.5 py-1 text-xs font-medium tracking-[0.1px]',
                    phase === 'completed' &&
                      'bg-success-muted text-success hover:bg-success-muted',
                  )}
                  variant={isError ? 'destructive' : 'secondary'}
                >
                  {sheetState}
                </Badge>
              </div>
              <SheetDescription className="mt-1 truncate text-xs leading-4">
                Add one or multiple files. OCR starts automatically.
              </SheetDescription>
            </div>

            <Button
              aria-label="Close upload panel"
              asChild
              className="size-10 shrink-0 bg-accent text-accent-foreground hover:bg-accent/80"
              size="icon"
              type="button"
              variant="ghost"
            >
              <SheetClose>
                <X aria-hidden="true" />
              </SheetClose>
            </Button>
          </SheetHeader>

          <Separator />

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted px-6 text-center transition-colors hover:border-primary/60 ${
                selectedFile ? 'h-[136px]' : 'h-[300px]'
              }`}
              htmlFor="invoiceFile"
            >
              {!selectedFile ? (
                <span className="flex size-12 items-center justify-center rounded-full bg-card text-foreground">
                  <Plus aria-hidden="true" className="size-5" />
                </span>
              ) : null}

              <span className="text-base font-semibold leading-6 text-foreground">
                Drop invoices here
              </span>
              <span className="text-xs leading-4 text-muted-foreground">
                PDF, PNG or JPG — up to 10 MB per file
              </span>
              <Button asChild className="pointer-events-none" type="button">
                <span>
                  <Upload aria-hidden="true" />
                  Browse files
                </span>
              </Button>

              <input
                accept=".pdf,.png,.jpg,.jpeg"
                aria-describedby={errorMessage ? 'invoice-upload-error' : undefined}
                aria-invalid={Boolean(errorMessage)}
                className="sr-only"
                disabled={isBusy}
                id="invoiceFile"
                key={inputKey}
                name="file"
                type="file"
                onChange={onFileChange}
              />
            </label>

            {isError ? (
              <Alert
                className="min-h-21 border-transparent bg-destructive text-destructive-foreground [&>svg]:text-destructive-foreground"
                variant="destructive"
              >
                <AlertTitle className="text-xs leading-4 tracking-[0.1px]">
                  {phase === 'ocr-error' ? 'OCR processing failed' : 'Upload failed'}
                </AlertTitle>
                <AlertDescription className="text-xs leading-4" id="invoice-upload-error">
                  {phase === 'ocr-error'
                    ? `The original file is safe${createdInvoiceId ? ` as invoice #${createdInvoiceId}` : ''}. Retry OCR or review it manually.`
                    : errorMessage}
                </AlertDescription>
              </Alert>
            ) : null}

            {selectedFile ? (
              <div className="space-y-4">
                <p className="text-xs font-medium leading-4 tracking-[0.1px] text-foreground">
                  Files (1)
                </p>
                <UploadFileCard
                  errorMessage={errorMessage}
                  file={selectedFile}
                  onRemove={onRemoveFile}
                  onRetryOcr={onRetryOcr}
                  onRetryUpload={() => {
                    const form = document.getElementById('invoiceFile')?.closest('form')
                    form?.requestSubmit()
                  }}
                  phase={phase}
                  uploadProgress={uploadProgress}
                />
              </div>
            ) : (
              <p className="text-xs leading-4 text-muted-foreground">
                Multiple files can be uploaded simultaneously.
              </p>
            )}
          </div>

          <Separator />

          <SheetFooter className="flex min-h-[79px] shrink-0 flex-row items-center justify-between space-x-0 px-6">
            <Button asChild type="button" variant="secondary">
              <SheetClose>Cancel</SheetClose>
            </Button>

            {phase === 'completed' ? (
              <Button asChild type="button">
                <SheetClose>View in inbox</SheetClose>
              </Button>
            ) : phase === 'ocr-error' ? (
              <Button onClick={onRetryOcr} type="button">
                <RotateCcw aria-hidden="true" />
                Retry OCR
              </Button>
            ) : isBusy ? (
              <Button aria-disabled="true" className="pointer-events-none" type="button">
                {phase === 'uploading' ? 'Uploading…' : 'Processing…'}
              </Button>
            ) : selectedFile ? (
              <Button type="submit">
                {errorMessage ? (
                  <RotateCcw aria-hidden="true" />
                ) : (
                  <Upload aria-hidden="true" />
                )}
                {errorMessage ? 'Retry failed uploads' : 'Upload 1 invoice'}
              </Button>
            ) : (
              <Button asChild type="button">
                <label className="cursor-pointer" htmlFor="invoiceFile">
                  <Upload aria-hidden="true" />
                  Browse files
                </label>
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
