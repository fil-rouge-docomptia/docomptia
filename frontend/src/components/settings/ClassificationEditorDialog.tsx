import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

import { ClassificationMutationError } from '@/components/settings/ClassificationMutationError'
import { classificationTypeLabel, classificationTypes } from '@/components/settings/classification-utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/services/api'
import { createClassification, updateClassification } from '@/services/classification'
import type { Classification, ClassificationInput, ClassificationType } from '@/types/classification'

type ClassificationEditorDialogProps = {
  category?: Classification
  initialType?: ClassificationType
  onClose: () => void
  onSaved: (category: Classification) => void
  onRestoreFocus: () => void
}

export function ClassificationEditorDialog({ category, initialType = 'DOSSIER', onClose, onSaved, onRestoreFocus }: ClassificationEditorDialogProps) {
  const id = useId()
  const [type, setType] = useState<ClassificationType>(initialType)
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const request = useRef<AbortController | null>(null)
  const nameField = useRef<HTMLInputElement>(null)
  const denied = error instanceof ApiError && [403, 404].includes(error.status)
  const changes: Partial<Omit<ClassificationInput, 'type'>> = {}
  if (name.trim() !== category?.name) changes.name = name.trim()
  if (description.trim() !== (category?.description ?? '')) changes.description = description.trim()

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { if (nameError && !saving) nameField.current?.focus() }, [nameError, saving])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (request.current || denied || (category && !Object.keys(changes).length)) return
    if (!name.trim()) {
      setNameError('Enter a category name.')
      nameField.current?.focus()
      return
    }
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    setNameError(null)
    try {
      const saved = category
        ? await updateClassification(category.classificationId, changes, controller.signal)
        : await createClassification({ type, name: name.trim(), description: description.trim() }, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error)
        if (error instanceof ApiError && error.status === 409) {
          setNameError('This name is already used for this type, including inactive categories.')
          nameField.current?.focus()
        }
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open && !request.current) onClose() }} open>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg [&>button]:right-2 [&>button]:top-2 [&>button]:size-11" onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus() }} onOpenAutoFocus={(event) => { event.preventDefault(); nameField.current?.focus() }}>
        <form aria-busy={saving} aria-label={category ? 'Edit category' : 'Create category'} className="space-y-5" noValidate onSubmit={(event) => void save(event)}>
          <DialogHeader className="text-left">
            <DialogTitle className="pr-8">{category ? 'Edit category' : 'Create category'}</DialogTitle>
            <DialogDescription>{category ? 'Update the category information. Existing invoice links are kept.' : 'Add a folder, binder or project / site for your organization.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${id}-type`}>Type</Label>
            {category ? <Input id={`${id}-type`} readOnly value={classificationTypeLabel(category.type)} /> : (
              <Select disabled={saving} onValueChange={(value: ClassificationType) => { setType(value); setNameError(null) }} value={type}>
                <SelectTrigger className="h-11" id={`${id}-type`}><SelectValue /></SelectTrigger>
                <SelectContent>{classificationTypes.map(({ value, label }) => <SelectItem className="min-h-11" key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {category ? <p className="text-xs text-muted-foreground">The category type cannot be changed.</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input aria-describedby={nameError ? `${id}-name-error` : undefined} aria-invalid={Boolean(nameError)} className="h-11" disabled={saving} id={`${id}-name`} onChange={(event) => { setName(event.target.value); setNameError(null) }} ref={nameField} required value={name} />
            {nameError ? <p className="text-xs text-destructive" id={`${id}-name-error`}>{nameError}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-description`}>Description (optional)</Label>
            <Textarea disabled={saving} id={`${id}-description`} onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
          </div>
          <ClassificationMutationError error={error} />
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button className="h-11" disabled={saving} onClick={onClose} type="button" variant="secondary">Cancel</Button>
            <Button className="h-11" disabled={saving || denied || Boolean(category && !Object.keys(changes).length)} type="submit">
              {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
