import type { RoleCode } from '@/types/auth'

export function canManageProjectSites(role?: RoleCode) {
  return role === 'ADMIN'
}

export function formatProjectSiteDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date)
}
