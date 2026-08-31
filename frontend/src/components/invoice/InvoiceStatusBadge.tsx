import { Badge } from '@/components/ui/badge'

const statusLabels: Record<string, string> = {
  A_VERIFIER: 'Waiting approval',
  ARCHIVEE: 'Archived',
  COMPTABILISEE: 'Accounted',
  DEPOSEE: 'To process',
  ERREUR_OCR: 'OCR error',
  EXPORTEE: 'Exported',
  EXPORTABLE: 'Ready to export',
  EXTRAITE: 'Needs review',
  OCR_EN_COURS: 'Processing',
  REJETEE: 'Rejected',
  VALIDEE: 'Approved',
}

const statusClasses: Record<string, string> = {
  A_VERIFIER: 'border-warning/20 bg-warning-muted text-warning-muted-foreground',
  ARCHIVEE: 'border-border bg-secondary text-secondary-foreground',
  COMPTABILISEE: 'border-info/20 bg-info-muted text-info',
  DEPOSEE: 'border-border bg-secondary text-secondary-foreground',
  ERREUR_OCR: 'border-destructive/20 bg-destructive/10 text-destructive',
  EXPORTEE: 'border-success/20 bg-success-muted text-success',
  EXPORTABLE: 'border-success/20 bg-success-muted text-success',
  EXTRAITE: 'border-warning/20 bg-warning-muted text-warning-muted-foreground',
  OCR_EN_COURS: 'border-info/20 bg-info-muted text-info',
  REJETEE: 'border-destructive/20 bg-destructive/10 text-destructive',
  VALIDEE: 'border-success/20 bg-success-muted text-success',
}

type InvoiceStatusBadgeProps = {
  status: string
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <Badge
      className={statusClasses[status] ?? 'border-border bg-background text-foreground'}
      variant="outline"
    >
      {statusLabels[status] ?? status.replaceAll('_', ' ')}
    </Badge>
  )
}
