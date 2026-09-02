import { type FormEvent, useId, useState } from 'react'
import { AlertCircle, LoaderCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/services/api'
import { createProjectSite, updateProjectSite } from '@/services/project-site'
import type { ProjectSite } from '@/types/project-site'

type ProjectSiteDialogProps = {
  onOpenChange: (open: boolean) => void
  onSaved: (projectSite: ProjectSite) => void
  open: boolean
  projectSite?: ProjectSite
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'The project or site could not be saved. Try again.'
}

export function ProjectSiteDialog({
  onOpenChange,
  onSaved,
  open,
  projectSite,
}: ProjectSiteDialogProps) {
  const fieldId = useId()
  const [name, setName] = useState(projectSite?.name ?? '')
  const [description, setDescription] = useState(projectSite?.description ?? '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const editing = Boolean(projectSite)
  const changed = name.trim() !== (projectSite?.name ?? '')
    || description.trim() !== (projectSite?.description ?? '')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const input = { description: description.trim(), name: name.trim() }
      const savedProjectSite = projectSite
        ? await updateProjectSite(projectSite.classificationId, input)
        : await createProjectSite(input)
      onSaved(savedProjectSite)
      onOpenChange(false)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!submitting) {
      onOpenChange(nextOpen)
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit project' : 'Create project'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the project or construction site information.'
                : 'Create a construction-site classification for your organization.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-name`}>Project / Site name</Label>
              <Input
                autoFocus
                id={`${fieldId}-name`}
                onChange={(event) => setName(event.target.value)}
                placeholder="For example: Résidence Bellevue"
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-description`}>Description</Label>
              <Input
                id={`${fieldId}-description`}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional project context"
                value={description}
              />
            </div>
          </div>

          {errorMessage ? (
            <Alert className="mt-5" variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Unable to save project</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="mt-5 gap-2 sm:space-x-0">
            <Button
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={submitting || !name.trim() || (editing && !changed)}
              type="submit"
            >
              {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
