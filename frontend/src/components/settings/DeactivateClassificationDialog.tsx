import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

import { ClassificationMutationError } from '@/components/settings/ClassificationMutationError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/services/api'
import { deactivateClassification } from '@/services/classification'
import type { Classification } from '@/types/classification'

type DeactivateClassificationDialogProps = {
  category: Classification
  onClose: () => void
  onSaved: (category: Classification) => void
  onRestoreFocus: () => void
}

export function DeactivateClassificationDialog({ category, onClose, onSaved, onRestoreFocus }: DeactivateClassificationDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const request = useRef<AbortController | null>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const denied = error instanceof ApiError && [403, 404].includes(error.status)
  useEffect(() => () => request.current?.abort(), [])

  async function confirm() {
    if (!category.active || request.current || denied) return
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    try {
      const saved = await deactivateClassification(category.classificationId, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
    } catch (error) {
      if (!controller.signal.aborted) setError(error)
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open && !request.current) onClose() }} open>
      <DialogContent aria-busy={saving} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-md [&>button]:right-2 [&>button]:top-2 [&>button]:size-11" onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus() }} onOpenAutoFocus={(event) => { event.preventDefault(); cancelButton.current?.focus() }}>
        <DialogHeader className="text-left">
          <DialogTitle className="pr-8">Deactivate category?</DialogTitle>
          <DialogDescription className="break-words">{category.name} will become inactive and unavailable for new invoice links. Existing invoice links are kept. The category will remain visible in this list.</DialogDescription>
        </DialogHeader>
        <ClassificationMutationError error={error} />
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button className="h-11" disabled={saving} onClick={onClose} ref={cancelButton} variant="secondary">Cancel</Button>
          <Button className="h-11" disabled={saving || denied} onClick={() => void confirm()} variant="destructive">
            {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {saving ? 'Deactivating…' : 'Deactivate category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
