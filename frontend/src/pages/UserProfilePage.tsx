import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import { getCurrentUser } from '@/services/auth'
import type { CurrentUser } from '@/types/auth'

function ProfileField({ id, label, value, hint }: { id: string, label: string, value: string, hint?: string }) {
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label><Input aria-describedby={hint ? `${id}-hint` : undefined} className="h-11" id={id} readOnly value={value} />{hint && <p className="text-xs text-muted-foreground" id={`${id}-hint`}>{hint}</p>}</div>
}

function Profile({ userId, organizationId }: { userId: number, organizationId: number }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number, profile: CurrentUser | null, error?: unknown } | null>(null)
  const current = result?.attempt === attempt ? result : null
  useEffect(() => {
    const controller = new AbortController()
    getCurrentUser(controller.signal).then((profile) => {
      if (!profile || profile.id !== userId || profile.organization?.id !== organizationId
        || ![profile.firstName, profile.lastName, profile.email, profile.organization.name, profile.role?.label].every((value) => typeof value === 'string')
        || !['ADMIN', 'OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE'].includes(profile.role?.code)) throw new Error('Invalid profile')
      if (!controller.signal.aborted) setResult({ attempt, profile })
    }).catch((error: unknown) => { if (!controller.signal.aborted) setResult({ attempt, profile: null, error }) })
    return () => controller.abort()
  }, [attempt, userId, organizationId])
  const profile = current?.profile
  return <div className="space-y-6 px-2 md:px-0">
    <PageHeader actions={<Button onClick={() => setAttempt((n) => n + 1)} variant="outline">Refresh profile</Button>} description="Review your personal details, preferences and account security." title="User profile" />
    <div className="mx-auto max-w-[832px] space-y-8">
      {!current ? <div aria-busy="true" aria-label="Loading profile" className="space-y-4" role="status"><Skeleton className="h-7 w-32" /><Skeleton className="h-80" /></div>
        : !profile ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{current.error instanceof ApiError && current.error.status === 403 ? 'Profile access denied' : 'Profile unavailable'}</AlertTitle><AlertDescription className="space-y-3"><p>Your profile could not be loaded. Please try again.</p><Button onClick={() => setAttempt((n) => n + 1)} variant="outline">Retry profile</Button></AlertDescription></Alert>
          : <>
            <section aria-labelledby="profile-heading" className="space-y-4">
              <h2 className="text-lg font-semibold" id="profile-heading">Profile</h2>
              <p className="text-xs text-muted-foreground">Your personal information and profile photo.</p>
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex flex-col items-center gap-4 sm:flex-row"><Avatar className="size-12"><AvatarFallback className="bg-primary text-xs text-primary-foreground">{[profile.firstName, profile.lastName].map((name) => name.trim().charAt(0)).join('').toUpperCase()}</AvatarFallback></Avatar><div className="space-y-2 text-center sm:text-left"><p className="text-xs font-medium">Profile photo</p><p className="text-xs text-muted-foreground">Photo uploads are not available yet.</p><Button className="min-h-11" disabled variant="outline">Change photo</Button></div></div>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileField hint="Your given name." id="profile-first-name" label="First name" value={profile.firstName} />
                  <ProfileField hint="Your family name." id="profile-last-name" label="Last name" value={profile.lastName} />
                  <ProfileField hint="Used for sign-in and personal notifications." id="profile-email" label="Email" value={profile.email} />
                  <ProfileField id="profile-role" label="Role" value={profile.role.label} />
                </div>
                <p className="text-xs text-muted-foreground">Your profile is read only here. An administrator can update your identity from Members.</p>
              </div>
            </section>
            <section aria-labelledby="profile-preferences-heading" className="space-y-4">
              <h2 className="text-lg font-semibold" id="profile-preferences-heading">Preferences</h2>
              <p className="text-xs text-muted-foreground">Personal language, time zone and appearance preferences are not available yet.</p>
              <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                <ProfileField id="profile-language" label="Language preference" value="Not available" />
                <ProfileField id="profile-timezone" label="Time zone preference" value="Not available" />
                <ProfileField id="profile-appearance" label="Appearance preference" value="Not available" />
                <ProfileField hint="The organization associated with your account." id="profile-workspace" label="Current workspace" value={profile.organization.name} />
              </div>
            </section>
          </>}
      <section aria-labelledby="profile-notifications-heading" className="space-y-4">
        <h2 className="text-lg font-semibold" id="profile-notifications-heading">Personal notifications</h2>
        <p className="text-xs text-muted-foreground">Review the notifications sent to your account.</p>
        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="space-y-1"><h3 className="text-sm font-medium">Notification preferences</h3><p className="text-xs text-muted-foreground">Review available notification settings.</p></div><Button asChild className="min-h-11 whitespace-normal" variant="link"><Link to="/settings/notifications">Open notification preferences</Link></Button></div>
      </section>
      <section aria-labelledby="profile-security-heading" className="space-y-4">
        <h2 className="text-lg font-semibold" id="profile-security-heading">Security</h2>
        <p className="text-xs text-muted-foreground">Review sign-in security and available session actions.</p>
        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Password changes, two-factor authentication and remote sessions are not available yet.</p><Button asChild className="min-h-11" variant="outline"><Link to="/settings/security">Open security settings</Link></Button></div>
      </section>
    </div>
  </div>
}

export default function UserProfilePage() {
  const { user } = useAuth()
  return user ? <Profile key={`${user.id}:${user.organization.id}`} organizationId={user.organization.id} userId={user.id} /> : null
}
