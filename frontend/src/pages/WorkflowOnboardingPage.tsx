import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { WorkflowSetupForm } from '@/components/onboarding/WorkflowSetupForm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getValidationPreferences } from '@/services/onboarding'
import type { ValidationPreferences } from '@/types/onboarding'

export default function WorkflowOnboardingPage() {
  const navigate = useNavigate()
  const [preferences, setPreferences] = useState<ValidationPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadingError, setHasLoadingError] = useState(false)

  useEffect(() => {
    let isActive = true

    getValidationPreferences()
      .then((currentPreferences) => {
        if (isActive) {
          setPreferences(currentPreferences)
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
      setPreferences(await getValidationPreferences())
    } catch {
      setHasLoadingError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OnboardingLayout>
      <div className="flex flex-col gap-6">
        <OnboardingStepHeader
          currentStep={3}
          stepLabel="Workflow"
          title="Approval workflow preset"
        />

        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading approval workflow"
            className="flex min-h-64 items-center justify-center"
          >
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          </div>
        ) : null}

        {hasLoadingError ? (
          <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            <AlertTitle>Unable to load the approval workflow</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>Check your connection and try again.</span>
              <Button onClick={() => void retryLoading()} size="sm" variant="outline">
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {preferences && !isLoading ? (
          <WorkflowSetupForm
            onBack={() => navigate('/onboarding/accounting')}
            onComplete={() => navigate('/onboarding/team')}
            preferences={preferences}
          />
        ) : null}
      </div>
    </OnboardingLayout>
  )
}
