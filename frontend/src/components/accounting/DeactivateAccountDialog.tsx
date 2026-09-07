import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

import { AccountMutationError } from '@/components/accounting/AccountMutationError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/services/api'
import { deactivateAccount } from '@/services/chart-of-accounts'
import type { ChartOfAccount } from '@/types/onboarding'

type DeactivateAccountDialogProps = {
  account: ChartOfAccount
  onClose: () => void
  onSaved: (account: ChartOfAccount) => void
  onRestoreFocus: () => void
}

export function DeactivateAccountDialog({ account, onClose, onSaved, onRestoreFocus }: DeactivateAccountDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const request = useRef<AbortController | null>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const denied = error instanceof ApiError && [403, 404].includes(error.status)

  useEffect(() => () => request.current?.abort(), [])

  async function confirm() {
    if (!account.active || request.current || denied) return
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    try {
      const saved = await deactivateAccount(account.accountId, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
    } catch (error) {
      if (!controller.signal.aborted) setError(error)
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open && !request.current) onClose() }} open>
      <DialogContent
        aria-busy={saving}
        className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-md [&>button]:size-11 [&>button]:right-2 [&>button]:top-2"
        onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus() }}
        onOpenAutoFocus={(event) => { event.preventDefault(); cancelButton.current?.focus() }}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="pr-8">Deactivate account?</DialogTitle>
          <DialogDescription className="break-words">
            {account.accountNumber} — {account.accountLabel} will become inactive. Existing entries and rule references will be kept.
          </DialogDescription>
        </DialogHeader>
        <AccountMutationError error={error} />
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button disabled={saving} onClick={onClose} ref={cancelButton} variant="secondary">Cancel</Button>
          <Button disabled={saving || denied} onClick={() => void confirm()} variant="destructive">
            {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {saving ? 'Deactivating…' : 'Deactivate account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
