import { Badge } from '@/components/ui/badge'

import { invoiceStatusLabels } from './invoice-status'

const statusClasses: Record<string, string> = {
  A_VERIFIER: 'border-warning/20 bg-warning-muted text-warning-muted-foreground',
  ARCHIVEE: 'border-border bg-secondary text-secondary-foreground',
  COMPTABILISEE: 'border-info/20 bg-info-muted text-info',
  DEPOSEE: 'border-border bg-secondary text-secondary-foreground',
  DUPLICATE_SUSPECTED: 'border-warning/20 bg-warning-muted text-warning-muted-foreground',
  ERREUR_OCR: 'border-destructive/20 bg-destructive/10 text-destructive',
  EXPORTEE: 'border-border bg-background text-foreground',
  EXPORTABLE: 'border-primary bg-primary text-primary-foreground',
  EXTRAITE: 'border-warning/20 bg-warning-muted text-warning-muted-foreground',
  OCR_EN_COURS: 'border-info/20 bg-info-muted text-info',
  REJETEE: 'border-destructive/20 bg-destructive/10 text-destructive',
  VALIDEE: 'border-success/20 bg-success-muted text-success',
}

type InvoiceStatusBadgeProps = {
  label?: string
  status: string
}

export function InvoiceStatusBadge({ label, status }: InvoiceStatusBadgeProps) {
  return (
    <Badge
      className={statusClasses[status] ?? 'border-border bg-background text-foreground'}
      variant="outline"
    >
      {label ?? invoiceStatusLabels[status] ?? status.replaceAll('_', ' ')}
    </Badge>
  )
}
