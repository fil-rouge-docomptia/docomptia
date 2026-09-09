import { useEffect, useState } from 'react'
import { AlertCircle, ScrollText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { AuditEventList } from '@/components/settings/AuditEventList'
import { AuditFilters } from '@/components/settings/AuditFilters'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { auditActions, auditResources, emptyAuditFilters, getAuditEvents, type AuditEvent, type AuditFilters as Filters } from '@/services/audit'
import type { PageResponse } from '@/types/onboarding'

const description = 'Review traceable actions performed across your organization.'
const validDate = (value: string) => !value || (/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) && value <= '9998-12-31' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value)

function AuditSettings({ organizationId }: { organizationId: number }) {
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(Object.keys(emptyAuditFilters).map((key) => [key, params.get(key) ?? ''])) as Filters
  const pageValue = params.get('page') ?? '1'
  const page = Number(pageValue) - 1
  const invalid = !/^[1-9]\d*$/.test(pageValue) || !Number.isSafeInteger(page) || page * 25 > 2147483647
    || (filters.userId !== '' && (!/^[1-9]\d*$/.test(filters.userId) || !Number.isSafeInteger(Number(filters.userId))))
    || (filters.action !== '' && !Object.hasOwn(auditActions, filters.action))
    || (filters.resource !== '' && !Object.hasOwn(auditResources, filters.resource))
    || !validDate(filters.from) || !validDate(filters.to) || (filters.from !== '' && filters.to !== '' && filters.from > filters.to)
  const [retry, setRetry] = useState(0)
  const requestKey = JSON.stringify({ filters, page, retry })
  const [result, setResult] = useState<{ key: string, data: PageResponse<AuditEvent> | null, error: unknown } | null>(null)
  const current = result?.key === requestKey ? result : null
  useEffect(() => {
    if (invalid) return
    const controller = new AbortController()
    const { filters, page } = JSON.parse(requestKey) as { filters: Filters, page: number }
    getAuditEvents(filters, page, organizationId, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult({ key: requestKey, data, error: null }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error }) })
    return () => controller.abort()
  }, [requestKey, invalid, organizationId])
  function changeFilter(key: keyof Filters, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    next.delete('page')
    setParams(next)
  }
  function changePage(number: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(number))
    setParams(next)
  }
  const data = current?.data
  const error = current?.error
  const forbidden = error instanceof ApiError && error.status === 403
  const unavailable = error instanceof ApiError && [404, 405, 501].includes(error.status)
  return <SettingsLayout description={description} section="audit-logs" actions={<Button onClick={() => setRetry((n) => n + 1)} variant="outline">Refresh logs</Button>}>
    <Alert className="border-0 bg-info-muted" role="note"><AlertTitle className="text-xs">Read-only audit trail</AlertTitle><AlertDescription className="text-xs">Events cannot be edited or deleted here. Sensitive values and invoice contents are excluded.</AlertDescription></Alert>
    <AuditFilters filters={filters} onChange={changeFilter} />
    {(invalid || Object.values(filters).some(Boolean)) && <Button onClick={() => setParams({})} variant="outline">Clear filters</Button>}
    {invalid ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Invalid audit filters</AlertTitle><AlertDescription>Choose valid filters and a date range whose start is not after its end.</AlertDescription></Alert>
      : error ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{forbidden ? 'Audit access denied' : unavailable ? 'Audit logs unavailable' : 'Unable to load audit logs'}</AlertTitle><AlertDescription className="space-y-3"><p>{forbidden ? 'You do not have permission to view audit events in this organization.' : unavailable ? 'Audit consultation is not available yet. No events can be shown.' : 'The events could not be loaded. Please try again.'}</p><Button onClick={() => setRetry((n) => n + 1)} variant="outline">Retry logs</Button></AlertDescription></Alert>
        : !data ? <div aria-busy="true" aria-label="Loading audit logs" className="space-y-3" role="status"><Skeleton className="h-10" />{Array.from({ length: 5 }, (_, i) => <Skeleton className="h-12" key={i} />)}</div>
          : <>
            {data.content.length ? <AuditEventList events={data.content} key={requestKey} organizationId={organizationId} /> : <div className="space-y-3 rounded-lg border border-dashed px-5 py-12 text-center" role="status"><ScrollText aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><h3 className="font-semibold">{page > 0 ? 'No events on this page' : Object.values(filters).some(Boolean) ? 'No matching events' : 'No audit events yet'}</h3><p className="text-sm text-muted-foreground">{page > 0 ? 'The results may have changed. Return to the first page.' : 'Recorded events will appear here when they are available.'}</p>{page > 0 && <Button onClick={() => changePage(1)} variant="outline">First page</Button>}</div>}
            {data.content.length > 0 && <div className="[&_button]:min-h-11"><SupplierPagination ariaLabel="Audit pagination" currentPage={page + 1} itemLabel="events" onPageChange={changePage} pageSize={25} totalElements={data.totalElements} totalPages={data.totalPages} /></div>}
          </>}
  </SettingsLayout>
}

export default function AuditSettingsPage() {
  const { user } = useAuth()
  if (user?.role.code !== 'ADMIN') return <SettingsLayout description={description} section="audit-logs"><Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Audit access denied</AlertTitle><AlertDescription>Only administrators can view the organization’s audit trail.</AlertDescription></Alert></SettingsLayout>
  return <AuditSettings key={`${user.id}:${user.organization.id}:${user.role.code}`} organizationId={user.organization.id} />
}
