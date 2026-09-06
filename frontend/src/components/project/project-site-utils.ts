import { hasPermission } from '@/lib/permissions'

export function canManageProjectSites(permissions?: readonly string[]) {
  return hasPermission(permissions, 'classification.manage')
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
