import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { AccountingSettingsForm } from '@/components/settings/AccountingSettingsForm'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { getCurrentOrganization } from '@/services/organization'
import type { Organization } from '@/types/organization'

function AccountingSettings({ organizationId, canManage }: { organizationId: number, canManage: boolean }) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ retry: number, organization: Organization | null, error: unknown } | null>(null)
  const current = result?.retry === retry ? result : null
  const forbidden = current?.error instanceof ApiError && current.error.status === 403

  useEffect(() => {
    const controller = new AbortController()
    getCurrentOrganization(controller.signal)
      .then((organization) => {
        if (!organization || organization.organizationId !== organizationId || (organization.defaultCurrencyCode !== null && (typeof organization.defaultCurrencyCode !== 'string' || !/^[A-Z]{3}$/.test(organization.defaultCurrencyCode)))) {
          throw new Error('Invalid accounting preferences')
        }
        if (!controller.signal.aborted) setResult({ retry, organization, error: null })
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ retry, organization: null, error }) })
    return () => controller.abort()
  }, [organizationId, retry])

  return (
    <SettingsLayout description="Configure fiscal defaults, accounts and export preferences." section="accounting">
      {current?.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>{forbidden ? 'Accounting settings access denied' : 'Unable to load accounting settings'}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{forbidden ? 'You do not have access to this organization’s settings.' : 'Current accounting preferences could not be loaded. Please try again.'}</p>
            <Button onClick={() => setRetry((value) => value + 1)} variant="outline">Retry</Button>
          </AlertDescription>
        </Alert>
      ) : !current?.organization ? (
        <div aria-busy="true" aria-label="Loading accounting settings" className="space-y-6" role="status">
          <Skeleton className="h-44" /><Skeleton className="h-52" /><Skeleton className="h-52" />
        </div>
      ) : <AccountingSettingsForm
        canManage={canManage}
        key={retry}
        onReload={() => setRetry((value) => value + 1)}
        onSaved={(organization) => setResult({ retry, organization, error: null })}
        organization={current.organization}
      />}
    </SettingsLayout>
  )
}

export default function AccountingSettingsPage() {
  const { user } = useAuth()
  if (!user) return null
  return <AccountingSettings canManage={user.role.code === 'ADMIN'} key={`${user.id}:${user.organization.id}:${user.role.code}`} organizationId={user.organization.id} />
}
