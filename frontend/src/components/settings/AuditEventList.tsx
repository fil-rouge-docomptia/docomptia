import { Fragment, useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/services/api'
import { auditActions, auditChangeValue, auditResources, auditTimestamp, getAuditEvent, type AuditEvent } from '@/services/audit'

function EventDetails({ id, organizationId }: { id: number, organizationId: number }) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ retry: number, event: AuditEvent | null, error: unknown } | null>(null)
  const current = result?.retry === retry ? result : null
  useEffect(() => {
    const controller = new AbortController()
    getAuditEvent(id, organizationId, controller.signal)
      .then((event) => { if (!controller.signal.aborted) setResult({ retry, event, error: null }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ retry, event: null, error }) })
    return () => controller.abort()
  }, [id, organizationId, retry])
  const event = current?.event
  if (current?.error) return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Event details unavailable</AlertTitle><AlertDescription className="space-y-3"><p>{current.error instanceof ApiError && current.error.status === 403 ? 'You no longer have permission to read this event.' : 'This event could not be loaded. It may no longer be accessible.'}</p><Button onClick={() => setRetry((n) => n + 1)} variant="outline">Retry event</Button></AlertDescription></Alert>
  if (!event) return <div aria-busy="true" aria-label="Loading event details" className="space-y-3" role="status"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-20" /></div>
  return <div className="space-y-4 rounded-md bg-info-muted p-4">
    <p className="text-xs">This event is read only. Tokens, passwords and invoice contents are not included.</p>
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted-foreground">Event</dt><dd className="mt-1">#{event.id} · {auditActions[event.action]}</dd></div>
      <div><dt className="text-xs text-muted-foreground">User</dt><dd className="mt-1 break-words">{event.actor?.name || 'User unavailable'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Recorded time</dt><dd className="mt-1">{auditTimestamp(event.occurredAt)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Resource</dt><dd className="mt-1">{auditResources[event.resource]}{event.resourceId !== null ? ` #${event.resourceId}` : ''}</dd></div>
      {event.change ? <><div><dt className="text-xs text-muted-foreground">Previous {event.change.field === 'role' ? 'role' : 'status'}</dt><dd className="mt-1">{auditChangeValue(event.change, event.change.previousValue)}</dd></div><div><dt className="text-xs text-muted-foreground">New {event.change.field === 'role' ? 'role' : 'status'}</dt><dd className="mt-1">{auditChangeValue(event.change, event.change.newValue)}</dd></div></> : <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Change details</dt><dd className="mt-1">Detailed values are not available in this audit view.</dd></div>}
    </dl>
  </div>
}

export function AuditEventList({ events, organizationId }: { events: AuditEvent[], organizationId: number }) {
  const [selected, setSelected] = useState<number | null>(null)
  return <Table aria-label="Audit events" className="block xl:table">
    <TableHeader className="hidden bg-muted text-xs xl:table-header-group"><TableRow>{['Timestamp', 'User', 'Action', 'Resource', 'Details', ''].map((label) => <TableHead className="h-10 px-3" key={label}>{label || <span className="sr-only">View event</span>}</TableHead>)}</TableRow></TableHeader>
    <TableBody className="block space-y-3 xl:table-row-group xl:space-y-0">
      {events.map((event) => <Fragment key={event.id}>
        <TableRow className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-lg border p-4 hover:bg-background max-xl:border! xl:table-row xl:rounded-none xl:border-x-0 xl:border-t-0 xl:p-0 [&>td]:min-w-0 [&>td]:p-0 xl:[&>td]:px-3 xl:[&>td]:py-2">
          <TableCell className="col-span-2 text-xs text-muted-foreground"><div className="flex items-center justify-between gap-2"><span>{auditTimestamp(event.occurredAt)}</span><Badge className="xl:hidden" variant="secondary">Read only</Badge></div></TableCell>
          <TableCell className="col-span-2 order-2 break-words text-xs text-muted-foreground xl:text-sm xl:text-foreground">{event.actor?.name || 'User unavailable'}</TableCell>
          <TableCell className="col-span-2 order-1 text-sm">{auditActions[event.action]}</TableCell>
          <TableCell className="col-span-2 order-3 text-xs xl:text-sm">{auditResources[event.resource]}{event.resourceId !== null ? ` #${event.resourceId}` : ''}</TableCell>
          <TableCell className="order-4 self-center text-xs text-muted-foreground">{event.change ? `${auditChangeValue(event.change, event.change.previousValue)} → ${auditChangeValue(event.change, event.change.newValue)}` : 'Details restricted'}</TableCell>
          <TableCell className="order-5"><Button aria-controls={selected === event.id ? `audit-event-${event.id}` : undefined} aria-expanded={selected === event.id} aria-label={`${selected === event.id ? 'Hide' : 'View'} event ${event.id}`} className="h-11 bg-accent text-accent-foreground xl:h-8" onClick={() => setSelected(selected === event.id ? null : event.id)} variant="ghost">{selected === event.id ? 'Hide' : 'View'}</Button></TableCell>
        </TableRow>
        {selected === event.id && <TableRow className="block border-0 hover:bg-transparent xl:table-row"><TableCell className="block p-0 pb-4 xl:table-cell" colSpan={6}><section aria-label={`Event ${event.id} details`} id={`audit-event-${event.id}`}><EventDetails id={event.id} key={event.id} organizationId={organizationId} /></section></TableCell></TableRow>}
      </Fragment>)}
    </TableBody>
  </Table>
}
