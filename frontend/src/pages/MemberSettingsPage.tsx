import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Search, UserPlus, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { MemberActionsMenu, type MemberAction, type MemberActionHandler } from '@/components/settings/MemberActionsMenu'
import { MemberDialog } from '@/components/settings/MemberDialog'
import { InviteMemberDialog } from '@/components/settings/InviteMemberDialog'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { getOrganizationMembers } from '@/services/members'
import type { OrganizationUser } from '@/types/onboarding'

const description = 'Manage who has access to your workspace.'
const pageSize = 5
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
type MemberSettingsDialog = { action: 'invite' } | { action: MemberAction, member: OrganizationUser }

function MemberSettings() {
  const { user, updateCurrentUser, signOut } = useAuth()
  const [params, setParams] = useSearchParams()
  const query = (params.get('q') ?? '').slice(0, 200)
  const status = ['active', 'inactive'].includes(params.get('status') ?? '') ? params.get('status')! : 'all'
  const requestedPage = Number(params.get('page') ?? '1')
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ retry: number, members: OrganizationUser[] | null, error: unknown } | null>(null)
  const current = result?.retry === retry ? result : null
  const members = current?.members
  const [dialog, setDialog] = useState<MemberSettingsDialog | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    getOrganizationMembers(controller.signal)
      .then((members) => { if (!controller.signal.aborted) setResult({ retry, members, error: null }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ retry, members: null, error }) })
    return () => controller.abort()
  }, [retry])

  const filtered = (members ?? []).filter((member) => (
    (status === 'all' || member.active === (status === 'active')) &&
    normalize(`${member.firstName} ${member.lastName} ${member.email}`).includes(normalize(query.trim()))
  )).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id - b.id)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1
  const activeAdmins = (members ?? []).filter(({ active, role }) => active && role.code === 'ADMIN').length

  function changeQuery(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value && value !== 'all' && !(key === 'page' && value === '1')) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }
  const openDialog: MemberActionHandler = (action, member, button) => { trigger.current = button; setDialog({ action, member }) }
  function invited(member: OrganizationUser) {
    setDialog(null)
    setResult((value) => value?.members ? { ...value, members: [...value.members.filter(({ id }) => id !== member.id), member] } : value)
    const next = new URLSearchParams(params)
    next.set('q', member.email)
    next.delete('status')
    next.delete('page')
    setParams(next)
    toast.success(member.active ? 'Member added.' : 'Invitation created. The member is inactive.')
  }
  function saved(member: OrganizationUser) {
    setDialog(null)
    setResult((value) => value?.members ? { ...value, members: value.members.map((item) => item.id === member.id ? member : item) } : value)
    toast.success(dialog?.action === 'edit' ? 'Member updated.' : dialog?.action === 'role' ? 'Member role updated.' : member.active ? 'Member activated.' : 'Member deactivated. Historical records are kept.')
    if (user?.id === member.id) {
      if (!member.active) signOut()
      else updateCurrentUser(member)
    }
  }
  const forbidden = current?.error instanceof ApiError && current.error.status === 403
  const restoreFocus = () => {
    const target = trigger.current?.isConnected && !trigger.current.hasAttribute('disabled') ? trigger.current : search.current
    target?.focus()
  }

  return (
    <SettingsLayout actions={<Button className="h-11" disabled={!members} onClick={(event) => { trigger.current = event.currentTarget; setDialog({ action: 'invite' }) }}><UserPlus aria-hidden="true" />Invite member</Button>} description={description} section="members">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input aria-label="Search members" className="h-11 pl-9" maxLength={200} onChange={(event) => changeQuery('q', event.target.value)} placeholder="Search members…" ref={search} value={query} /></div>
        <Select onValueChange={(value) => changeQuery('status', value)} value={status}><SelectTrigger aria-label="Filter by status" className="h-11 w-[124px]"><SelectValue><span className="text-xs">{status === 'all' ? 'All statuses' : status === 'active' ? 'Active' : 'Inactive'}</span></SelectValue></SelectTrigger><SelectContent><SelectItem className="min-h-11" value="all">All statuses</SelectItem><SelectItem className="min-h-11" value="active">Active</SelectItem><SelectItem className="min-h-11" value="inactive">Inactive</SelectItem></SelectContent></Select>
      </div>
      {current?.error ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{forbidden ? 'Member access denied' : 'Unable to load members'}</AlertTitle><AlertDescription className="space-y-3"><p>{forbidden ? 'Only administrators can access members in this organization.' : 'The complete member list could not be loaded. Please try again.'}</p><Button onClick={() => setRetry((value) => value + 1)} variant="outline">Retry</Button></AlertDescription></Alert> : !members ? (
        <div aria-busy="true" aria-label="Loading members" className="space-y-3" role="status"><Skeleton className="h-10" />{Array.from({ length: 5 }, (_, index) => <Skeleton className="h-16" key={index} />)}</div>
      ) : (
        <div className="space-y-4">
          {filtered.length ? <Table aria-label="Organization members" className="table-fixed max-sm:block [&_th]:h-10 sm:[&_td]:py-1">
            <TableHeader className="bg-muted max-sm:sr-only"><TableRow className="border-0"><TableHead className="w-[50%] text-xs min-[1440px]:w-[27%]">User</TableHead><TableHead className="hidden w-[27%] text-xs min-[1440px]:table-cell">Email</TableHead><TableHead className="text-xs">Role</TableHead><TableHead className="w-24 text-xs">Status</TableHead><TableHead className="hidden w-24 text-xs min-[1440px]:table-cell">Last active</TableHead><TableHead className="w-12"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody className="max-sm:block">{filtered.slice((page - 1) * pageSize, page * pageSize).map((member) => (
              <TableRow className="max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto_44px] max-sm:items-center max-sm:py-3" key={member.id}>
                <TableCell className="max-sm:col-span-2 max-sm:p-0 max-sm:pb-2"><div className="flex min-w-0 items-center gap-2"><Avatar className="size-7 shrink-0"><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{member.firstName[0]}{member.lastName[0]}</AvatarFallback></Avatar><div className="min-w-0"><p className="break-words text-xs font-medium">{member.firstName} {member.lastName}{member.id === user?.id ? <span className="font-normal text-muted-foreground"> (you)</span> : null}</p><p className="break-all text-xs text-muted-foreground min-[1440px]:hidden">{member.email}</p></div></div></TableCell>
                <TableCell className="hidden break-all text-xs min-[1440px]:table-cell">{member.email}</TableCell>
                <TableCell className="break-words text-xs text-muted-foreground max-sm:col-start-1 max-sm:row-start-2 max-sm:p-0 max-sm:pl-9">{member.role.label}</TableCell>
                <TableCell className="max-sm:col-start-2 max-sm:row-start-2 max-sm:p-0"><Badge className={`text-[10px] font-normal ${member.active ? 'bg-accent text-accent-foreground hover:bg-accent' : ''}`} variant={member.active ? 'default' : 'secondary'}>{member.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                <TableCell className="hidden text-xs text-muted-foreground min-[1440px]:table-cell"><span aria-label="Last activity unavailable">—</span></TableCell>
                <TableCell className="p-0 text-right max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1"><MemberActionsMenu member={member} onAction={openDialog} protectedAdmin={member.active && member.role.code === 'ADMIN' && activeAdmins === 1} /></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table> : <div className="rounded-lg border border-dashed px-5 py-12 text-center"><Users aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" /><h3 className="font-semibold">{members.length ? 'No matching members' : 'No members yet'}</h3><p className="mt-2 text-sm text-muted-foreground">{members.length ? 'Try another name, email address or status.' : 'Members of your organization will appear here.'}</p>{query || status !== 'all' ? <Button className="mt-4 h-11" onClick={() => { const next = new URLSearchParams(params); ['q', 'status', 'page'].forEach((key) => next.delete(key)); setParams(next) }} variant="outline">Clear filters</Button> : null}</div>}
          <div className="[&_button]:min-h-11 [&_button]:min-w-11 [&_nav>div]:flex-wrap [&_nav>div]:gap-1 [&_nav]:px-0 sm:[&_nav>div]:gap-2"><SupplierPagination ariaLabel="Member pagination" currentPage={page} itemLabel="members" onPageChange={(page) => changeQuery('page', String(page))} pageSize={pageSize} totalElements={filtered.length} totalPages={totalPages} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Inactive members remain listed. Last activity is not available.</p><Button className="h-11" onClick={() => setRetry((value) => value + 1)} variant="outline">Reload members</Button></div>
        </div>
      )}
      {dialog ? dialog.action === 'invite'
        ? <InviteMemberDialog onClose={() => setDialog(null)} onCreated={invited} onRestoreFocus={restoreFocus} />
        : <MemberDialog action={dialog.action} isSelf={dialog.member.id === user?.id} member={dialog.member} onClose={() => setDialog(null)} onRestoreFocus={restoreFocus} onSaved={saved} /> : null}
    </SettingsLayout>
  )
}

export default function MemberSettingsPage() {
  const { user } = useAuth()
  if (user?.role.code !== 'ADMIN') return <SettingsLayout description={description} section="members"><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Member access denied</AlertTitle><AlertDescription>Only administrators can access members in this organization.</AlertDescription></Alert></SettingsLayout>
  return <MemberSettings key={`${user.id}:${user.organization.id}:${user.role.code}`} />
}
