import { useId, useRef, useState } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/services/api'

const rejectionReasons = [
  { label: 'Incorrect amount', value: 'incorrect-amount' },
  { label: 'Missing information', value: 'missing-information' },
  { label: 'Duplicate', value: 'duplicate' },
  { label: 'Wrong supplier', value: 'wrong-supplier' },
  { label: 'Other', value: 'other' },
] as const

type RejectionReason = (typeof rejectionReasons)[number]['value']

function getRejectionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'You no longer have permission to reject this invoice.'
    }
    if (error.status === 409) {
      return 'This invoice can no longer be rejected. Refresh the review and try again.'
    }
    if (error.status === 400 && error.message) {
      return error.message
    }
  }

  return 'Unable to reject the invoice. Your reason and comment have been kept.'
}

function buildRejectionReason(reason: RejectionReason, comment: string) {
  const reasonLabel = rejectionReasons.find((item) => item.value === reason)?.label
  const trimmedComment = comment.trim()

  if (!reasonLabel) {
    return null
  }

  return trimmedComment ? `${reasonLabel}: ${trimmedComment}` : reasonLabel
}

type InvoiceRejectionDialogProps = {
  onOpenChange: (open: boolean) => void
  onReject: (reason: string) => Promise<void>
  open: boolean
}

export function InvoiceRejectionDialog({
  onOpenChange,
  onReject,
  open,
}: InvoiceRejectionDialogProps) {
  const reasonLabelId = useId()
  const commentId = useId()
  const [reason, setReason] = useState<RejectionReason>('incorrect-amount')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  const resetForm = () => {
    setReason('incorrect-amount')
    setComment('')
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

    if (pendingRef.current) {
      return
    }

    const rejectionReason = buildRejectionReason(reason, comment)

    if (!rejectionReason) {
      setError('Choose a rejection reason.')
      return
    }

    setError(null)
    pendingRef.current = true
    setPending(true)

    try {
      await onReject(rejectionReason)
      resetForm()
      onOpenChange(false)
    } catch (requestError: unknown) {
      setError(getRejectionErrorMessage(requestError))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-[560px] gap-3 bg-popover text-popover-foreground [&>button.absolute]:hidden">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-[-0.25px]">Reject invoice</DialogTitle>
          <DialogDescription className="text-xs leading-4">
            Choose a reason and add context for the requester.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium tracking-[0.1px]" id={reasonLabelId}>
              Reason <span className="text-destructive-text">*</span>
            </legend>
            <RadioGroup
              aria-labelledby={reasonLabelId}
              className="gap-1"
              onValueChange={(value) => setReason(value as RejectionReason)}
              required
              value={reason}
            >
              {rejectionReasons.map((item) => {
                const id = `${reasonLabelId}-${item.value}`

                return (
                  <div className="flex h-6 items-center gap-2" key={item.value}>
                    <RadioGroupItem
                      className="size-5 border-muted-foreground"
                      disabled={pending}
                      id={id}
                      value={item.value}
                    />
                    <Label className="font-normal leading-5" htmlFor={id}>{item.label}</Label>
                  </div>
                )
              })}
            </RadioGroup>
          </fieldset>

          <div className="space-y-2">
            <Label className="text-xs tracking-[0.1px]" htmlFor={commentId}>Comment</Label>
            <Textarea
              className="min-h-24 resize-none text-xs leading-4"
              disabled={pending}
              id={commentId}
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a comment for the requester…"
              value={comment}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
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
            <Button disabled={pending} type="submit" variant="destructive">
              {pending ? 'Rejecting…' : 'Reject invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
