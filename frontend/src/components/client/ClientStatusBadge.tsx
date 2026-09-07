import { Badge } from '@/components/ui/badge'

export function ClientStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      className={active
        ? 'border-transparent bg-success-muted font-medium text-success'
        : 'border-transparent bg-secondary font-medium text-secondary-foreground'}
      variant="outline"
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}
