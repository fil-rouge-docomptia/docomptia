import { useId, useState } from 'react'
import type { FormEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/services/api'

function getCorrectionRequestErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'You no longer have permission to request changes to this invoice.'
    }
    if (error.status === 409) {
      return 'Changes can no longer be requested for this invoice. Refresh the review and try again.'
    }
    if (error.status === 400 && error.message) {
      return error.message
    }
  }

  return 'Unable to request changes. Your instructions have been kept.'
}

type InvoiceCorrectionRequestDialogProps = {
  onOpenChange: (open: boolean) => void
  onRequestCorrection: (reason: string) => Promise<void>
  open: boolean
}

export function InvoiceCorrectionRequestDialog({
  onOpenChange,
  onRequestCorrection,
  open,
}: InvoiceCorrectionRequestDialogProps) {
  const reasonId = useId()
  const errorId = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const trimmedReason = reason.trim()

  const resetForm = () => {
    setReason('')
    setError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) {
      return
    }
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!trimmedReason) {
      setError('Describe what needs to be corrected.')
      return
    }

    setError(null)
    setPending(true)

    try {
      await onRequestCorrection(trimmedReason)
      resetForm()
      onOpenChange(false)
    } catch (requestError: unknown) {
      setError(getCorrectionRequestErrorMessage(requestError))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-[560px] gap-3 bg-popover text-popover-foreground [&>button.absolute]:hidden">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-[-0.25px]">Request changes</DialogTitle>
          <DialogDescription className="text-xs leading-4">
            Describe what the requester needs to update before resubmitting the invoice.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label className="text-xs tracking-[0.1px]" htmlFor={reasonId}>
              Correction instructions <span className="text-destructive-text">*</span>
            </Label>
            <Textarea
              aria-describedby={error ? errorId : undefined}
              aria-invalid={Boolean(error)}
              className="min-h-28 resize-none text-xs leading-4"
              disabled={pending}
              id={reasonId}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describe the fields, amounts, or documents that need to be corrected…"
              required
              value={reason}
            />
          </div>

          {error ? (
            <Alert id={errorId} variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              disabled={pending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={pending || !trimmedReason} type="submit">
              {pending ? 'Sending…' : 'Send request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
