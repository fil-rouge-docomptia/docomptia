import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { InvoiceDetails } from '@/types/invoice'

import {
  getInvoiceLifecycleNotice,
  type InvoiceLifecycleNoticeTone,
} from './invoice-lifecycle'

const toneClasses: Record<InvoiceLifecycleNoticeTone, string> = {
  destructive: 'border-destructive bg-destructive text-destructive-foreground',
  info: 'border-info/20 bg-info-muted text-foreground',
  neutral: 'border-border bg-muted text-foreground',
  success: 'border-success/20 bg-success-muted text-foreground',
  warning: 'border-warning/30 bg-warning-muted text-foreground',
}

export function InvoiceLifecycleNotice({ invoice }: { invoice: InvoiceDetails }) {
  const notice = getInvoiceLifecycleNotice(invoice)

  if (!notice) {
    return null
  }

  return (
    <Alert
      aria-label="Invoice lifecycle status"
      className={cn('shadow-none', toneClasses[notice.tone])}
      role="status"
    >
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription className={notice.tone === 'destructive'
        ? 'text-destructive-foreground/90'
        : 'text-muted-foreground'}>
        {notice.description}
      </AlertDescription>
    </Alert>
  )
}
