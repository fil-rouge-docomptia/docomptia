import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, FolderTree, Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ClassificationEditorDialog } from '@/components/settings/ClassificationEditorDialog'
import { ClassificationList } from '@/components/settings/ClassificationList'
import { DeactivateClassificationDialog } from '@/components/settings/DeactivateClassificationDialog'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { classificationTypes, parseClassificationType } from '@/components/settings/classification-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { listClassifications } from '@/services/classification'
import type { Classification, ClassificationPage } from '@/types/classification'

type DialogState = { action: 'create' } | { action: 'edit' | 'deactivate', category: Classification }
const pageSize = 8

function CategorySettings({ canManage }: { canManage: boolean }) {
  const [params, setParams] = useSearchParams()
  const requestedPage = Number(params.get('page') ?? '1')
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const type = parseClassificationType(params.get('type'))
  const [retry, setRetry] = useState(0)
  const key = `${type ?? 'all'}:${page}:${retry}`
  const [result, setResult] = useState<{ key: string, data: ClassificationPage | null, error: unknown } | null>(null)
  const current = result?.key === key ? result : null
  const data = current?.data
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const filterButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    listClassifications({ page: page - 1, size: pageSize, type }, controller.signal)
      .then((data) => {
        if (!data || !Array.isArray(data.content)) throw new Error('Invalid category list')
        if (!controller.signal.aborted) setResult({ key, data, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, data: null, error })
      })
    return () => controller.abort()
  }, [key, page, type])

  function changeQuery(nextType: string | undefined, nextPage: number) {
    const next = new URLSearchParams(params)
    if (nextType) next.set('type', nextType)
    else next.delete('type')
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setParams(next)
  }

  function openDialog(next: DialogState, button: HTMLButtonElement) {
    trigger.current = button
    setDialog(next)
  }

  function saved(category: Classification) {
    const action = dialog?.action
    setDialog(null)
    toast.success(action === 'create' ? 'Category created.' : action === 'deactivate' ? 'Category deactivated. Existing invoice links are kept.' : 'Category updated.')
    if (action === 'deactivate' && data) {
      // Deactivation does not change the server's type/name ordering or remove historical rows.
      setResult({ key, data: { ...data, content: data.content.map((item) => item.classificationId === category.classificationId ? category : item) }, error: null })
    } else {
      if (action === 'create') changeQuery(parseClassificationType(category.type), 1)
      setRetry((value) => value + 1)
    }
  }

  const restoreFocus = () => {
    const target = trigger.current?.isConnected && !trigger.current.disabled ? trigger.current : filterButton.current
    target?.focus()
  }
  const forbidden = current?.error instanceof ApiError && current.error.status === 403
  const unavailable = current?.error instanceof ApiError && [404, 405, 501].includes(current.error.status)

  return (
    <SettingsLayout actions={canManage ? <Button className="h-11 shrink-0" disabled={!data} onClick={(event) => openDialog({ action: 'create' }, event.currentTarget)}><Plus aria-hidden="true" />Create category</Button> : null} description="Manage folders, binders and projects / sites for your organization." section="categories">
      {!canManage ? <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">Only administrators can manage categories. You have read-only access.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select onValueChange={(value) => changeQuery(parseClassificationType(value), 1)} value={type ?? 'all'}>
          <SelectTrigger aria-label="Filter by type" className="h-11 w-full sm:w-48" ref={filterButton}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem className="min-h-11" value="all">All types</SelectItem>{classificationTypes.map(({ value, label }) => <SelectItem className="min-h-11" key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="h-11" disabled={!current} onClick={() => setRetry((value) => value + 1)} variant="outline">Reload categories</Button>
      </div>
      {current?.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>{forbidden ? 'Category access denied' : unavailable ? 'Categories unavailable' : 'Unable to load categories'}</AlertTitle>
          <AlertDescription className="space-y-3"><p>{forbidden ? 'You do not have access to the categories in this organization.' : 'The category list could not be loaded. Please try again.'}</p><Button onClick={() => setRetry((value) => value + 1)} variant="outline">Retry</Button></AlertDescription>
        </Alert>
      ) : !data ? (
        <div aria-busy="true" aria-label="Loading categories" className="space-y-3" role="status"><Skeleton className="h-10" />{Array.from({ length: 5 }, (_, index) => <Skeleton className="h-14" key={index} />)}</div>
      ) : (
        <div className="space-y-4">
          {data.content.length ? <ClassificationList canManage={canManage} categories={data.content} onDeactivate={(category, button) => openDialog({ action: 'deactivate', category }, button)} onEdit={(category, button) => openDialog({ action: 'edit', category }, button)} /> : (
            <div className="rounded-lg border border-dashed px-5 py-12 text-center">
              <FolderTree aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" />
              <h3 className="font-semibold">{page > 1 ? 'No categories on this page' : type ? 'No categories of this type' : 'No categories yet'}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{page > 1 ? 'Return to the first page to see the available categories.' : canManage ? 'Create a category to organize your invoices.' : 'An administrator can create categories for your organization.'}</p>
              {page > 1 ? <Button className="mt-4 h-11" onClick={() => changeQuery(type, 1)} variant="outline">First page</Button> : null}
            </div>
          )}
          <nav aria-label="Category pagination" className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>{data.content.length ? `${data.number * data.size + 1}–${data.number * data.size + data.content.length}` : '0'} of {data.totalElements} categories</p>
            <div className="flex items-center gap-2">
              <Button aria-label="Previous page" className="size-11" disabled={page <= 1} onClick={() => changeQuery(type, page - 1)} size="icon" variant="outline"><ChevronLeft aria-hidden="true" /></Button>
              <span aria-live="polite">Page {page} of {Math.max(data.totalPages, 1)}</span>
              <Button aria-label="Next page" className="size-11" disabled={page >= data.totalPages} onClick={() => changeQuery(type, page + 1)} size="icon" variant="outline"><ChevronRight aria-hidden="true" /></Button>
            </div>
          </nav>
          <p className="text-xs text-muted-foreground">Inactive categories remain visible. Existing invoice links are kept.</p>
        </div>
      )}
      {canManage && dialog ? dialog.action === 'deactivate'
        ? <DeactivateClassificationDialog category={dialog.category} onClose={() => setDialog(null)} onRestoreFocus={restoreFocus} onSaved={saved} />
        : <ClassificationEditorDialog category={dialog.action === 'edit' ? dialog.category : undefined} initialType={type} onClose={() => setDialog(null)} onRestoreFocus={restoreFocus} onSaved={saved} /> : null}
    </SettingsLayout>
  )
}

export default function ClassificationSettingsPage() {
  const { user } = useAuth()
  return <CategorySettings canManage={user?.role.code === 'ADMIN'} key={`${user?.id}:${user?.organization.id}:${user?.role.code}`} />
}
