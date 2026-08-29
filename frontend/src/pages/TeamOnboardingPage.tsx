import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { TeamInvitationForm } from '@/components/onboarding/TeamInvitationForm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getOrganizationUsers, getRoles } from '@/services/onboarding'
import type { OrganizationUser, ReferenceItem } from '@/types/onboarding'

type TeamSetupData = {
  invitations: OrganizationUser[]
  roles: ReferenceItem[]
}

async function loadTeamSetup(): Promise<TeamSetupData> {
  const [roles, users] = await Promise.all([getRoles(), getOrganizationUsers()])

  return {
    invitations: users.filter((user) => !user.active),
    roles,
  }
}

export default function TeamOnboardingPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<TeamSetupData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadingError, setHasLoadingError] = useState(false)

  useEffect(() => {
    let isActive = true

    loadTeamSetup()
      .then((setupData) => {
        if (isActive) {
          setData(setupData)
        }
      })
      .catch(() => {
        if (isActive) {
          setHasLoadingError(true)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  async function retryLoading() {
    setIsLoading(true)
    setHasLoadingError(false)

    try {
      setData(await loadTeamSetup())
    } catch {
      setHasLoadingError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OnboardingLayout>
      <div className="flex flex-col gap-6">
        <OnboardingStepHeader currentStep={4} stepLabel="Team" title="Invite your team" />

        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading team invitations"
            className="flex min-h-64 items-center justify-center"
          >
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          </div>
        ) : null}

        {hasLoadingError ? (
          <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            <AlertTitle>Unable to load team invitations</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>Check your connection and try again.</span>
              <Button onClick={() => void retryLoading()} size="sm" variant="outline">
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {data && !isLoading ? (
          <TeamInvitationForm
            initialInvitations={data.invitations}
            onBack={() => navigate('/onboarding/workflow')}
            onComplete={() => navigate('/onboarding/ready')}
            roles={data.roles}
          />
        ) : null}
      </div>
    </OnboardingLayout>
  )
}
