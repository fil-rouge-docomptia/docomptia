import { useEffect, useRef, useState } from 'react'
import { AlertCircle, GitBranch, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { WorkflowRuleEditor, type WorkflowAction } from '@/components/settings/WorkflowRuleEditor'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { getValidationPreferences } from '@/services/onboarding'
import type { ValidationPreferences } from '@/types/onboarding'

const formatAmount = (amount: number) => new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

function WorkflowSettings({ canManage }: { canManage: boolean }) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ retry: number, preferences: ValidationPreferences | null, error: unknown } | null>(null)
  const [action, setAction] = useState<WorkflowAction | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const reloadButton = useRef<HTMLButtonElement>(null)
  const current = result?.retry === retry ? result : null
  const preferences = current?.preferences
  const forbidden = current?.error instanceof ApiError && current.error.status === 403
  const threshold = preferences?.validationThreshold

  useEffect(() => {
    const controller = new AbortController()
    getValidationPreferences(controller.signal)
      .then((preferences) => { if (!controller.signal.aborted) setResult({ retry, preferences, error: null }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ retry, preferences: null, error }) })
    return () => controller.abort()
  }, [retry])

  function open(next: WorkflowAction, button: HTMLButtonElement) { trigger.current = button; setAction(next) }
  function reload() { setAction(null); setRetry((value) => value + 1) }
  function saved(preferences: ValidationPreferences) {
    setResult({ retry, preferences, error: null })
    setAction(null)
    toast.success(preferences.validationRequired ? 'Approval rule saved.' : 'Approval disabled.')
  }
  function restoreFocus() {
    const target = trigger.current?.isConnected && !trigger.current.disabled ? trigger.current : reloadButton.current
    target?.focus()
  }

  return (
    <SettingsLayout actions={canManage && (!preferences || !preferences.validationRequired) ? <Button className="h-11 shrink-0" disabled={!preferences} onClick={(event) => open('add', event.currentTarget)}><Plus aria-hidden="true" />Add rule</Button> : null} description="Configure simple invoice approval rules." section="workflow">
      {!canManage ? <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">Only administrators can change the approval workflow. You have read-only access.</p> : null}
      {current?.error ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{forbidden ? 'Workflow access denied' : 'Unable to load approval workflow'}</AlertTitle><AlertDescription className="space-y-3"><p>{forbidden ? 'You do not have permission to view this organization’s workflow.' : 'Current approval settings could not be loaded. Please try again.'}</p><Button onClick={reload} variant="outline">Retry</Button></AlertDescription></Alert> : !preferences ? (
        <div aria-busy="true" aria-label="Loading approval workflow" className="space-y-4" role="status"><Skeleton className="h-52" /><Skeleton className="h-28" /></div>
      ) : <div className="space-y-4">
        {preferences.validationRequired ? (
          <article aria-label="Active approval rule" className="space-y-3 rounded-lg border p-4">
            <div><h3 className="text-lg font-semibold">{threshold == null ? 'All invoices' : `Invoices ≥ ${formatAmount(threshold)}`}</h3><p className="mt-1 text-xs text-muted-foreground">{threshold == null ? 'Every invoice requires one approval step when submitted.' : 'Invoices at or above this total, including tax, require approval.'}</p></div>
            <div className="flex flex-wrap gap-2"><Badge variant="outline">{threshold == null ? 'All amounts' : `Total incl. tax ≥ ${formatAmount(threshold)}`}</Badge><Badge variant="outline">All projects / sites</Badge></div>
            <div className="flex flex-wrap items-center gap-3 text-xs"><span className="text-muted-foreground">Approval route</span><span className="flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">1</span>Any member with validation access</span></div>
            <div className="flex flex-wrap items-center justify-between gap-3"><Badge className="bg-accent text-accent-foreground" variant="secondary">Active</Badge>{canManage ? <div className="flex gap-2"><Button className="h-11 bg-accent text-accent-foreground hover:bg-accent/80" onClick={(event) => open('edit', event.currentTarget)} variant="ghost"><Pencil aria-hidden="true" />Edit rule</Button><Button className="h-11 bg-accent text-accent-foreground hover:bg-accent/80" onClick={(event) => open('disable', event.currentTarget)} variant="ghost">Disable</Button></div> : null}</div>
          </article>
        ) : <div className="rounded-lg border border-dashed px-5 py-10 text-center" role="status"><GitBranch aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" /><h3 className="font-semibold">No active approval rule</h3><p className="mt-2 text-sm text-muted-foreground">Invoices skip approval when submitted, after completeness checks.</p></div>}
        <section className="space-y-3 rounded-lg bg-muted p-4" aria-labelledby="workflow-default"><h3 className="text-lg font-semibold" id="workflow-default">Default behavior</h3><p className="text-sm">{!preferences.validationRequired ? 'No approval is required.' : threshold == null ? 'All submitted invoices require approval.' : `Invoices below ${formatAmount(threshold)} skip approval. Invoices exactly at the threshold require approval.`}</p><p className="text-xs text-muted-foreground">Changes apply when invoices are submitted. Existing invoice statuses are not changed.</p></section>
        <p className="text-xs text-muted-foreground">One organization-wide rule is available. Multiple rules, project-specific conditions, named approvers and sequential steps are not available yet.</p>
      </div>}
      <div><Button className="h-11" disabled={!current} onClick={reload} ref={reloadButton} variant="outline">Reload workflow</Button></div>
      {canManage && preferences && action ? <WorkflowRuleEditor action={action} onClose={() => setAction(null)} onReload={reload} onRestoreFocus={restoreFocus} onSaved={saved} preferences={preferences} /> : null}
    </SettingsLayout>
  )
}

export default function WorkflowSettingsPage() {
  const { user } = useAuth()
  return <WorkflowSettings canManage={user?.role.code === 'ADMIN'} key={`${user?.id}:${user?.organization.id}:${user?.role.code}`} />
}
