import { RotateCcw, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { InvoiceUploadPhase } from '@/types/invoice'

type UploadFileCardProps = {
  errorMessage: string
  file: File
  phase: InvoiceUploadPhase
  onRemove: () => void
  onRetryOcr: () => void
  onRetryUpload: () => void
  uploadProgress: number
}

function getFileExtension(filename: string) {
  return filename.split('.').pop()?.toUpperCase() || 'FILE'
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadFileCard({
  errorMessage,
  file,
  phase,
  onRemove,
  onRetryOcr,
  onRetryUpload,
  uploadProgress,
}: UploadFileCardProps) {
  const isBusy = phase === 'uploading' || phase === 'ocr-processing'
  const isOcrProcessing = phase === 'ocr-processing'
  const isCompleted = phase === 'completed'
  const isOcrError = phase === 'ocr-error'
  const isUploadError = phase === 'upload-error' || Boolean(errorMessage)
  const state = isOcrError
    ? { label: 'OCR error', progress: 100, variant: 'destructive' as const }
    : isUploadError
      ? { label: 'Upload error', progress: uploadProgress, variant: 'destructive' as const }
      : isCompleted
        ? { label: 'Completed', progress: 100, variant: 'default' as const }
        : isOcrProcessing
          ? { label: 'OCR processing', progress: undefined, variant: 'secondary' as const }
          : phase === 'uploading'
            ? { label: 'Uploading', progress: uploadProgress, variant: 'secondary' as const }
            : { label: 'Queued', progress: 0, variant: 'secondary' as const }

  return (
    <article
      className={cn(
        'flex min-h-28 flex-col gap-2.5 rounded-lg border bg-card p-3',
        isOcrProcessing && 'min-h-35',
      )}
    >
      <div className="flex min-h-13 min-w-0 flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
            {getFileExtension(file.name)}
          </span>

          <div className="min-w-0 text-xs leading-4">
            <p className="truncate font-medium tracking-[0.1px] text-foreground">{file.name}</p>
            <p className="mt-1 text-muted-foreground">
              {getFileExtension(file.name)} · {formatFileSize(file.size)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1">
          <Badge
            className={cn(
              'h-6 border-0 px-2.5 py-1 text-xs font-medium tracking-[0.1px]',
              (phase === 'uploading' || isOcrProcessing) &&
                'bg-info-muted text-info hover:bg-info-muted',
              isCompleted && 'bg-success-muted text-success hover:bg-success-muted',
            )}
            variant={state.variant}
          >
            {state.label}
          </Badge>

          {isOcrError ? (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/80"
              onClick={onRetryOcr}
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          ) : isUploadError ? (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/80"
              onClick={onRetryUpload}
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          ) : (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/80"
              disabled={isBusy}
              onClick={onRemove}
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Progress
          aria-label={
            isOcrProcessing ? 'OCR processing in progress' : `${state.label}: ${state.progress}%`
          }
          className={cn(
            'h-2 flex-1 bg-muted',
            (isUploadError || isOcrError) && '[&>div]:bg-destructive',
            isCompleted && '[&>div]:bg-success',
            isOcrProcessing &&
              '[&>div]:![transform:translateX(-35%)] [&>div]:animate-pulse',
          )}
          value={state.progress}
        />
        <span className="shrink-0 text-right text-xs text-muted-foreground">
          {isOcrProcessing ? 'Processing…' : `${state.progress}%`}
        </span>
      </div>

      {isOcrProcessing ? (
        <div aria-label="Preparing extracted invoice fields" className="flex h-4 gap-2">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : null}
    </article>
  )
}
