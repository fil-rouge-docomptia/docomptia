import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'

import { SearchableCombobox } from '@/components/onboarding/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { auditActions, auditResources, type AuditFilters as Filters } from '@/services/audit'
import { getOrganizationMembers } from '@/services/members'
import type { OrganizationUser } from '@/types/onboarding'

type Props = { filters: Filters, onChange: (key: keyof Filters, value: string) => void }

export function AuditFilters({ filters, onChange }: Props) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number, members: OrganizationUser[] | null } | null>(null)
  const current = result?.attempt === attempt ? result : null
  useEffect(() => {
    const controller = new AbortController()
    getOrganizationMembers(controller.signal).then((members) => {
      if (members.some((user) => !user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.firstName !== 'string' || typeof user.lastName !== 'string')) throw new Error('Invalid users')
      if (!controller.signal.aborted) setResult({ attempt, members })
    }).catch(() => { if (!controller.signal.aborted) setResult({ attempt, members: null }) })
    return () => controller.abort()
  }, [attempt])
  const options = [{ value: '', label: 'All users' }, ...(current?.members ?? []).map((user) => ({ value: String(user.id), label: `${user.firstName} ${user.lastName}` }))]
  if (filters.userId && !options.some(({ value }) => value === filters.userId)) options.push({ value: filters.userId, label: 'Selected user unavailable' })
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SearchableCombobox ariaLabel="Filter by user" disabled={!current?.members} emptyMessage="No matching users." id="audit-user" onValueChange={(value) => onChange('userId', value)} options={options} placeholder={current ? 'Users unavailable' : 'Loading users…'} searchPlaceholder="Search users…" value={filters.userId} />
        {([{ key: 'action', label: 'Action', options: auditActions }, { key: 'resource', label: 'Resource', options: auditResources }] as const).map(({ key, label, options }) => <Select key={key} onValueChange={(value) => onChange(key, value === 'all' ? '' : value)} value={filters[key] || 'all'}><SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`} className="h-11 min-w-0 text-xs md:h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All {label.toLowerCase()}s</SelectItem>{Object.entries(options).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>)}
        <Popover><PopoverTrigger asChild><Button aria-label="Filter by date" className="h-11 min-w-0 justify-between text-xs font-normal md:h-9" variant="outline"><span className="truncate">{filters.from || filters.to ? 'Date range applied' : 'Date'}</span><CalendarDays aria-hidden="true" className="shrink-0" /></Button></PopoverTrigger><PopoverContent align="end" className="w-72 space-y-3"><p className="text-sm font-medium">Recorded date</p>{(['from', 'to'] as const).map((key) => <div className="space-y-1.5" key={key}><Label htmlFor={`audit-${key}`}>{key === 'from' ? 'From' : 'To'}</Label><Input className="h-11" id={`audit-${key}`} max="9998-12-31" min="0001-01-01" onChange={(event) => onChange(key, event.target.value)} type="date" value={filters[key]} /></div>)}<p className="text-xs text-muted-foreground">Includes both dates, using the recorded server time.</p></PopoverContent></Popover>
      </div>
      {current && !current.members && <p className="text-xs text-muted-foreground" role="status">The user filter is unavailable. Other filters still work. <Button className="h-11 px-2 text-xs" onClick={() => setAttempt((n) => n + 1)} variant="link">Retry user filter</Button></p>}
    </div>
  )
}
