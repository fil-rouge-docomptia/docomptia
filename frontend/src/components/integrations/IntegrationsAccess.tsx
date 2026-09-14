import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/hooks/use-auth'

export function IntegrationsAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user?.role.code === 'ADMIN') return children

  return <div className="space-y-6">
    <PageHeader title="Integrations" description="Connections and tools for your organization." />
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Integrations access denied</AlertTitle>
      <AlertDescription>Only administrators can access integration settings.</AlertDescription>
    </Alert>
  </div>
}
