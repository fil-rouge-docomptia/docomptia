import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { PageResponse } from '@/types/onboarding'

export const auditActions = {
  ROLE_CHANGED: 'Changed member role', STATUS_CHANGED: 'Changed member status', UPDATED: 'Updated settings',
  CSV_IMPORT: 'Imported chart of accounts', FIELD_CORRECTION: 'Corrected invoice fields',
  LINE_CORRECTION: 'Corrected accounting line', ASSIGNEE_CHANGED: 'Changed invoice assignee',
  ACCOUNTING_ENTRY_REVERSED: 'Reversed accounting entry', CSV_EXPORT: 'CSV export event',
  FEC_EXPORT: 'FEC export event', OTHER: 'Other event',
} as const
export const auditResources = {
  User: 'Member', Organization: 'Organization', Invoice: 'Invoice', AccountingEntryLine: 'Accounting line',
  ChartOfAccount: 'Chart of accounts', AccountingCsvExport: 'CSV export', AccountingFecExport: 'FEC export', OTHER: 'Other resource',
} as const
export type AuditEvent = {
  id: number
  organizationId: number
  occurredAt: string | null
  actor: { id: number, name: string } | null
  action: keyof typeof auditActions
  resource: keyof typeof auditResources
  resourceId: number | null
  change: { field: 'role' | 'active', previousValue: string, newValue: string } | null
}
export type AuditFilters = { userId: string, action: string, resource: string, from: string, to: string }
export const emptyAuditFilters: AuditFilters = { userId: '', action: '', resource: '', from: '', to: '' }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

function parseEvent(value: unknown, organizationId: number): AuditEvent {
  if (!record(value) || !positiveId(value.id) || value.organizationId !== organizationId
    || (value.occurredAt !== null && (typeof value.occurredAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?$/.test(value.occurredAt) || Number.isNaN(Date.parse(value.occurredAt))))
    || (value.actor !== null && (!record(value.actor) || !positiveId(value.actor.id) || typeof value.actor.name !== 'string'))
    || (value.resourceId !== null && (typeof value.resourceId !== 'number' || !Number.isSafeInteger(value.resourceId) || value.resourceId < 0))) {
    throw new Error('Invalid audit event')
  }
  const action = typeof value.action === 'string' && Object.hasOwn(auditActions, value.action) ? value.action as AuditEvent['action'] : 'OTHER'
  const resource = typeof value.resource === 'string' && Object.hasOwn(auditResources, value.resource) ? value.resource as AuditEvent['resource'] : 'OTHER'
  let change: AuditEvent['change'] = null
  if (resource === 'User' && record(value.change)) {
    const roleChange = action === 'ROLE_CHANGED' && value.change.field === 'role'
    const statusChange = action === 'STATUS_CHANGED' && value.change.field === 'active'
    const allowed = roleChange ? ['ADMIN', 'OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE'] : statusChange ? ['true', 'false'] : []
    if (typeof value.change.previousValue === 'string' && typeof value.change.newValue === 'string'
      && allowed.includes(value.change.previousValue) && allowed.includes(value.change.newValue)) {
      change = { field: roleChange ? 'role' : 'active', previousValue: value.change.previousValue, newValue: value.change.newValue }
    }
  }
  return {
    id: value.id, organizationId, occurredAt: value.occurredAt as string | null,
    actor: record(value.actor) ? { id: value.actor.id as number, name: value.actor.name as string } : null,
    action, resource, resourceId: resource === 'OTHER' ? null : value.resourceId as number | null, change,
  }
}

export async function getAuditEvents(filters: AuditFilters, page: number, organizationId: number, signal: AbortSignal): Promise<PageResponse<AuditEvent>> {
  const query = new URLSearchParams({ page: String(page), size: '25' })
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value)
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/audit-logs?${query}`, { signal })
  const value: unknown = await response.json()
  if (!record(value) || !Array.isArray(value.content) || value.number !== page || value.size !== 25
    || typeof value.totalElements !== 'number' || !Number.isSafeInteger(value.totalElements) || value.totalElements < 0
    || value.totalPages !== Math.ceil(value.totalElements / 25)
    || value.content.length !== Math.max(0, Math.min(25, value.totalElements - page * 25))) throw new Error('Invalid audit page')
  const content = value.content.map((item) => parseEvent(item, organizationId))
  if (new Set(content.map(({ id }) => id)).size !== content.length) throw new Error('Duplicate audit events')
  return { content, number: page, size: 25, totalElements: value.totalElements, totalPages: value.totalPages as number }
}

export async function getAuditEvent(id: number, organizationId: number, signal: AbortSignal): Promise<AuditEvent> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/audit-logs/${id}`, { signal })
  const event = parseEvent(await response.json(), organizationId)
  if (event.id !== id) throw new Error('Unexpected audit event')
  return event
}

const roleNames: Record<string, string> = { ADMIN: 'Administrator', OPERATEUR_COMPTABLE: 'Accounting operator', RESPONSABLE_COMPTABLE: 'Accounting manager' }
export function auditChangeValue(change: NonNullable<AuditEvent['change']>, value: string) {
  return change.field === 'active' ? value === 'true' ? 'Active' : 'Inactive' : roleNames[value]
}
export function auditTimestamp(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value + 'Z')) : 'Date unavailable'
}
