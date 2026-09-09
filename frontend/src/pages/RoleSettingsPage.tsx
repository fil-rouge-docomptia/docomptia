import { useEffect, useState } from 'react'
import { AlertCircle, Info, Shield, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { ApiError } from '@/services/api'
import { getRoles } from '@/services/onboarding'
import type { ReferenceItem } from '@/types/onboarding'

const description = 'Review available roles and manage member assignments.'

function RoleSettings() {
  const [params, setParams] = useSearchParams()
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ retry: number, roles: ReferenceItem[] | null, error: unknown } | null>(null)
  const current = result?.retry === retry ? result : null
  const roles = current?.roles
  const selectedCode = params.get('role') ?? roles?.[0]?.code
  const selected = roles?.find(({ code }) => code === selectedCode)
  const forbidden = current?.error instanceof ApiError && current.error.status === 403

  useEffect(() => {
    const controller = new AbortController()
    getRoles(controller.signal)
      .then((roles) => {
        if (!Array.isArray(roles) || roles.some((role) => !role || typeof role.code !== 'string' || !role.code.trim() || typeof role.label !== 'string' || !role.label.trim()) || new Set(roles.map(({ code }) => code)).size !== roles.length) {
          throw new Error('Invalid role list')
        }
        if (!controller.signal.aborted) setResult({ retry, roles, error: null })
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ retry, roles: null, error }) })
    return () => controller.abort()
  }, [retry])

  function selectRole(code: string) {
    const next = new URLSearchParams(params)
    next.set('role', code)
    setParams(next)
  }

  return (
    <SettingsLayout description={description} section="roles">
      {current?.error ? (
        <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{forbidden ? 'Role access denied' : 'Unable to load roles'}</AlertTitle><AlertDescription className="space-y-3"><p>{forbidden ? 'You do not have permission to view roles in this organization.' : 'Available roles could not be loaded. Please try again.'}</p><Button onClick={() => setRetry((value) => value + 1)} variant="outline">Retry</Button></AlertDescription></Alert>
      ) : !roles ? (
        <div aria-busy="true" aria-label="Loading roles" className="grid gap-5 xl:grid-cols-[236px_minmax(0,1fr)]" role="status"><Skeleton className="h-48" /><div className="space-y-4"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-14" /><Skeleton className="h-40" /></div></div>
      ) : !roles.length ? (
        <div className="rounded-lg border border-dashed px-5 py-12 text-center" role="status"><Shield aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" /><h3 className="font-semibold">No roles available</h3><p className="mt-2 text-sm text-muted-foreground">No roles are currently available for this organization.</p><Button className="mt-4 h-11" onClick={() => setRetry((value) => value + 1)} variant="outline">Reload roles</Button></div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[236px_minmax(0,1fr)]">
          <nav aria-label="Available roles" className="hidden space-y-2 rounded-lg border p-4 xl:block">
            <h3 className="text-xs font-medium text-muted-foreground">Available roles</h3>
            {roles.map(({ code, label }) => {
              const next = new URLSearchParams(params)
              next.set('role', code)
              return <Link aria-current={selected?.code === code ? 'page' : undefined} className={cn('flex min-h-11 items-center rounded-md px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', selected?.code === code && 'bg-accent text-accent-foreground')} key={code} to={`?${next}`}><span className="min-w-0 break-words">{label}</span></Link>
            })}
          </nav>
          <div className="space-y-2 xl:hidden"><Label htmlFor="settings-role">Role</Label><Select onValueChange={selectRole} value={selected?.code ?? ''}><SelectTrigger className="h-11" id="settings-role"><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent>{roles.map(({ code, label }) => <SelectItem className="min-h-11" key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select></div>
          {selected ? (
            <section aria-label="Selected role" className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="min-w-0 break-words text-xl font-semibold tracking-[-0.25px]">{selected.label}</h3><Badge variant="secondary">Default role</Badge></div>
              <p className="flex items-start gap-2.5 rounded-lg bg-muted p-3 text-xs text-muted-foreground"><Shield aria-hidden="true" className="size-[18px] shrink-0 text-foreground" /><span>Default roles are managed by Docomptia and cannot be edited.</span></p>
              <div className="space-y-3 rounded-lg border p-4"><div className="flex items-center gap-2"><Info aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /><h4 className="text-lg font-semibold">Permission details unavailable</h4></div><p className="text-sm text-muted-foreground">Detailed permissions for this role are not available yet. Access controls still apply when members use the workspace.</p></div>
              <div className="space-y-3 rounded-lg border p-4"><h4 className="text-lg font-semibold">Member assignments</h4><p className="text-sm text-muted-foreground">View members with this role and update their assignments. Your organization must keep at least one active administrator.</p><Button asChild className="h-auto min-h-11 whitespace-normal text-left" variant="outline"><Link to={`/settings/members?${new URLSearchParams({ role: selected.code })}`}><Users aria-hidden="true" />Manage member roles</Link></Button></div>
            </section>
          ) : <div className="space-y-3 rounded-lg border p-5" role="status"><h3 className="font-semibold">Role unavailable</h3><p className="text-sm text-muted-foreground">The selected role is no longer available. Choose another role.</p><Button onClick={() => selectRole(roles[0].code)} variant="outline">Select an available role</Button></div>}
        </div>
      )}
    </SettingsLayout>
  )
}

export default function RoleSettingsPage() {
  const { user } = useAuth()
  if (user?.role.code !== 'ADMIN') return <SettingsLayout description={description} section="roles"><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Role access denied</AlertTitle><AlertDescription>Only administrators can view roles in this organization.</AlertDescription></Alert></SettingsLayout>
  return <RoleSettings key={`${user.id}:${user.organization.id}:${user.role.code}`} />
}
