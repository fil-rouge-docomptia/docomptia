import { LoaderCircle, RotateCcw, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type UploadFileCardProps = {
  errorMessage: string
  file: File
  isSubmitting: boolean
  isUploaded: boolean
  onRemove: () => void
  onRetry: () => void
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
  isSubmitting,
  isUploaded,
  onRemove,
  onRetry,
}: UploadFileCardProps) {
  const state = errorMessage
    ? { label: 'Upload error', progress: 0, variant: 'destructive' as const }
    : isUploaded
      ? { label: 'Uploaded', progress: 100, variant: 'default' as const }
      : isSubmitting
        ? { label: 'Uploading', progress: 0, variant: 'secondary' as const }
        : { label: 'Queued', progress: 0, variant: 'secondary' as const }

  return (
    <article className="flex min-h-28 flex-col gap-2.5 rounded-lg border bg-card p-3">
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
              isUploaded && 'bg-success-muted text-success hover:bg-success-muted',
            )}
            variant={state.variant}
          >
            {state.label}
          </Badge>

          {errorMessage ? (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/80"
              disabled={isSubmitting}
              onClick={onRetry}
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          ) : (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/80"
              disabled={isSubmitting}
              onClick={onRemove}
              type="button"
              variant="ghost"
            >
              {isSubmitting ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Progress
          aria-label={`${state.label}: ${state.progress}%`}
          className={cn(
            'h-2 flex-1 bg-muted',
            errorMessage && '[&>div]:bg-destructive',
            isUploaded && '[&>div]:bg-success',
          )}
          value={state.progress}
        />
        <span className="w-8 text-right text-xs text-muted-foreground">{state.progress}%</span>
      </div>
    </article>
  )
}
