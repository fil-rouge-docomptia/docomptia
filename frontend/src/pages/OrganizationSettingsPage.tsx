import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { OrganizationSettingsForm } from '@/components/settings/OrganizationSettingsForm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { getCurrentOrganization } from '@/services/organization'
import type { Organization } from '@/types/organization'

function GeneralSettings() {
  const { user, updateOrganization } = useAuth()
  const [retry, setRetry] = useState(0)
  const key = `${user?.id}:${user?.organization.id}:${user?.role.code}:${retry}`
  const organizationId = user?.organization.id
  const [result, setResult] = useState<{ key: string, organization: Organization | null, error: unknown } | null>(null)
  const current = result?.key === key ? result : null

  useEffect(() => {
    const controller = new AbortController()
    getCurrentOrganization(controller.signal)
      .then((organization) => {
        if (!organization) throw new ApiError(404)
        if (organization.organizationId !== organizationId) throw new Error('Unexpected organization')
        if (!controller.signal.aborted) setResult({ key, organization, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, organization: null, error })
      })
    return () => controller.abort()
  }, [key, organizationId])

  if (current?.error) {
    const forbidden = current.error instanceof ApiError && current.error.status === 403
    const unavailable = current.error instanceof ApiError && [404, 405, 501].includes(current.error.status)
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>{forbidden ? 'Organization access denied' : unavailable ? 'Organization settings unavailable' : 'Unable to load organization settings'}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{forbidden ? 'You do not have access to this organization.' : 'Your organization information could not be loaded. Please try again.'}</p>
          <Button onClick={() => setRetry((value) => value + 1)} type="button" variant="outline">Retry</Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!current?.organization) return (
    <div aria-busy="true" aria-label="Loading organization settings" className="space-y-4" role="status">
      <Skeleton className="h-7 w-40" />
      <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-20" key={index} />)}</div>
      <Skeleton className="h-24 w-full" />
    </div>
  )

  return <OrganizationSettingsForm
    canManage={user?.role.code === 'ADMIN'}
    key={key}
    onReload={() => setRetry((value) => value + 1)}
    onSaved={(organization) => {
      setResult({ key, organization, error: null })
      updateOrganization({ id: organization.organizationId, name: organization.name, legalName: organization.legalName })
    }}
    organization={current.organization}
  />
}

export default function OrganizationSettingsPage({ general = false }: { general?: boolean }) {
  return (
    <SettingsLayout description="Manage workspace identity and default preferences." overview={!general} section="general">
      <GeneralSettings />
    </SettingsLayout>
  )
}
