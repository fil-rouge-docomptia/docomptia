const statusLabels: Record<string, string> = {
  SELECTED: 'Ticket sélectionné',
  PREPARED: 'Branche préparée',
  IN_PROGRESS: 'Agent en cours',
  REVIEW_REQUIRED: 'Review requise',
  APPROVED: 'Approuvé',
  PUSHED: 'Branche poussée',
  JIRA_UPDATED: 'Terminé',
  BLOCKED: 'Bloqué',
  ABORTED: 'Arrêté',
}

export function StatusBadge({ status }: { status: string }) {
  const variant = status === 'BLOCKED' || status === 'ABORTED'
    ? 'destructive'
    : status === 'APPROVED' || status === 'JIRA_UPDATED'
      ? 'success'
      : status === 'IN_PROGRESS'
        ? 'warning'
        : 'default'
  const Icon = status === 'BLOCKED'
    ? CircleAlert
    : status === 'ABORTED'
      ? OctagonX
      : status === 'IN_PROGRESS'
        ? LoaderCircle
        : status === 'APPROVED' || status === 'JIRA_UPDATED'
          ? CircleCheck
          : Clock3

  return (
    <Badge variant={variant} className={status === 'IN_PROGRESS' ? '[&_svg]:animate-spin' : ''}>
      <Icon size={13} />
      {statusLabels[status] || status}
    </Badge>
  )
}
import { CircleAlert, CircleCheck, Clock3, LoaderCircle, OctagonX } from 'lucide-react'
import { Badge } from './ui/badge'
