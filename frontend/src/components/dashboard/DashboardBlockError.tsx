import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

type DashboardBlockErrorProps = {
  message: string
  onRetry?: () => void
}

export function DashboardBlockError({ message, onRetry }: DashboardBlockErrorProps) {
  return (
    <div
      className="flex h-full min-h-28 flex-col items-center justify-center gap-3 px-4 py-6 text-center"
      role="alert"
    >
      <AlertCircle aria-hidden="true" className="size-5 text-destructive" />
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          Try again
        </Button>
      ) : null}
    </div>
  )
}
