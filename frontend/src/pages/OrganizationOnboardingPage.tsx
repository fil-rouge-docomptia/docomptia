import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress'
import { OrganizationInformationForm } from '@/components/onboarding/OrganizationInformationForm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getCurrentOrganization } from '@/services/organization'
import type { Organization } from '@/types/organization'

export default function OrganizationOnboardingPage() {
  const navigate = useNavigate()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadingError, setHasLoadingError] = useState(false)

  useEffect(() => {
    let isActive = true

    getCurrentOrganization()
      .then((currentOrganization) => {
        if (isActive) {
          setOrganization(currentOrganization)
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
      setOrganization(await getCurrentOrganization())
    } catch {
      setHasLoadingError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OnboardingLayout>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold leading-7 tracking-[-0.25px]">
            Company information
          </h1>
          <p className="text-xs leading-4 text-muted-foreground">Step 1 of 5 · Company</p>
        </header>

        <OnboardingProgress />

        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading company information"
            className="flex min-h-64 items-center justify-center"
          >
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          </div>
        ) : null}

        {hasLoadingError ? (
          <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            <AlertTitle>Unable to load company information</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>Check your connection and try again.</span>
              <Button onClick={() => void retryLoading()} size="sm" variant="outline">
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {organization && !isLoading ? (
          <OrganizationInformationForm
            onBack={() => navigate('/dashboard')}
            onComplete={() => navigate('/dashboard', { replace: true })}
            organization={organization}
          />
        ) : null}
      </div>
    </OnboardingLayout>
  )
}
