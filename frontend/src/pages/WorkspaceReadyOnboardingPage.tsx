import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getOrganizationUsers, getValidationPreferences } from '@/services/onboarding'
import {
  getCurrentOrganization,
  getOrganizationOnboardingStatus,
} from '@/services/organization'
import type { Organization, OnboardingStatus } from '@/types/organization'
import type { OrganizationUser, ValidationPreferences } from '@/types/onboarding'

type WorkspaceSummary = {
  onboarding: OnboardingStatus
  organization: Organization
  users: OrganizationUser[]
  validationPreferences: ValidationPreferences
}

async function loadWorkspaceSummary(): Promise<WorkspaceSummary> {
  const [organization, onboarding, validationPreferences, users] = await Promise.all([
    getCurrentOrganization(),
    getOrganizationOnboardingStatus(),
    getValidationPreferences(),
    getOrganizationUsers(),
  ])

  return { onboarding, organization, users, validationPreferences }
}

function SummaryBadge({ complete, label }: { complete: boolean; label: string }) {
  return (
    <Badge
      className={complete
        ? 'border-transparent bg-success-muted font-medium text-success'
        : 'border-warning/30 bg-warning-muted font-medium text-warning-muted-foreground'}
      variant="outline"
    >
      {label}
    </Badge>
  )
}

export default function WorkspaceReadyOnboardingPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadingError, setHasLoadingError] = useState(false)

  useEffect(() => {
    let isActive = true

    loadWorkspaceSummary()
      .then((workspaceSummary) => {
        if (isActive) {
          setSummary(workspaceSummary)
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
      setSummary(await loadWorkspaceSummary())
    } catch {
      setHasLoadingError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const completedSteps = new Set(summary?.onboarding.completedSteps.map((step) => step.code))
  const hasCompany = completedSteps.has('ORGANIZATION_INFORMATION')
  const hasAccountingPreferences = completedSteps.has('ACCOUNTING_PREFERENCES')
  const hasAccounts = completedSteps.has('CHART_OF_ACCOUNTS')
  const hasTeam = (summary?.users.length ?? 0) > 1
  const isRequiredSetupComplete = summary?.onboarding.remainingActions.length === 0

  return (
    <OnboardingLayout>
      <div className="flex flex-col gap-6">
        <OnboardingStepHeader currentStep={5} stepLabel="Finish" title="Workspace ready" />

        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading workspace summary"
            className="flex min-h-64 items-center justify-center"
          >
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          </div>
        ) : null}

        {hasLoadingError ? (
          <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            <AlertTitle>Unable to load the workspace summary</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>Check your connection and try again.</span>
              <Button onClick={() => void retryLoading()} size="sm" variant="outline">
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {summary && !isLoading ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <Alert
              className={isRequiredSetupComplete
                ? 'border-success/20 bg-success-muted text-left'
                : 'border-warning/30 bg-warning-muted text-left'}
            >
              {isRequiredSetupComplete ? (
                <CircleCheck aria-hidden="true" className="size-4 text-success" />
              ) : (
                <CircleAlert aria-hidden="true" className="size-4 text-warning" />
              )}
              <AlertTitle>
                {isRequiredSetupComplete
                  ? 'Your workspace is ready'
                  : 'Workspace opened with pending setup'}
              </AlertTitle>
              <AlertDescription>
                {isRequiredSetupComplete
                  ? `${summary.organization.name} is ready for your first invoice.`
                  : 'You can open the workspace now. Complete the chart of accounts before generating accounting entries.'}
              </AlertDescription>
            </Alert>

            <h2 className="text-xl font-semibold leading-7 tracking-[-0.25px]">
              {isRequiredSetupComplete ? 'Everything is set up' : 'Continue when you are ready'}
            </h2>
            <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
              You can upload invoices, invite more teammates and refine accounting rules whenever
              needed. Deferred items remain available from Settings.
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              <SummaryBadge complete={hasCompany} label={hasCompany ? 'Company configured' : 'Company pending'} />
              <SummaryBadge
                complete={hasAccountingPreferences}
                label={hasAccountingPreferences ? 'Currency configured' : 'Currency pending'}
              />
              <SummaryBadge
                complete={hasAccounts}
                label={hasAccounts ? 'Accounts configured' : 'Accounts deferred'}
              />
              <SummaryBadge
                complete
                label={summary.validationPreferences.validationRequired
                  ? 'Approval workflow configured'
                  : 'Approval disabled'}
              />
              <SummaryBadge complete={hasTeam} label={hasTeam ? 'Team invited' : 'Team deferred'} />
            </div>
          </div>
        ) : null}

        {summary && !isLoading ? (
          <div className="flex items-center justify-between gap-4">
            <Button onClick={() => navigate('/onboarding/team')} type="button" variant="outline">
              Back
            </Button>
            <Button onClick={() => navigate('/dashboard', { replace: true })} type="button">
              Open workspace
            </Button>
          </div>
        ) : null}
      </div>
    </OnboardingLayout>
  )
}
