import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AccountingSetupForm } from '@/components/onboarding/AccountingSetupForm'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { OnboardingStepHeader } from '@/components/onboarding/OnboardingStepHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  getAccountingRules,
  getChartOfAccounts,
  getReferenceData,
} from '@/services/onboarding'
import { getCurrentOrganization } from '@/services/organization'
import type { Organization } from '@/types/organization'
import type { AccountingRule, ChartOfAccount, ReferenceItem } from '@/types/onboarding'

type AccountingSetupData = {
  accounts: ChartOfAccount[]
  currencies: ReferenceItem[]
  defaultRule: AccountingRule | null
  organization: Organization
}

async function loadAccountingSetup(): Promise<AccountingSetupData> {
  const [organization, referenceData, accounts, rules] = await Promise.all([
    getCurrentOrganization(),
    getReferenceData(),
    getChartOfAccounts(),
    getAccountingRules(),
  ])

  return {
    accounts,
    currencies: referenceData.currencies,
    defaultRule: rules.filter((rule) => rule.active).at(-1) ?? null,
    organization,
  }
}

export default function AccountingOnboardingPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<AccountingSetupData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadingError, setHasLoadingError] = useState(false)

  useEffect(() => {
    let isActive = true

    loadAccountingSetup()
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
      setData(await loadAccountingSetup())
    } catch {
      setHasLoadingError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OnboardingLayout>
      <div className="flex flex-col gap-6">
        <OnboardingStepHeader currentStep={2} stepLabel="Accounting" title="Accounting setup" />

        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading accounting setup"
            className="flex min-h-64 items-center justify-center"
          >
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          </div>
        ) : null}

        {hasLoadingError ? (
          <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            <AlertTitle>Unable to load accounting setup</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>Check your connection and try again.</span>
              <Button onClick={() => void retryLoading()} size="sm" variant="outline">
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {data && !isLoading ? (
          <AccountingSetupForm
            accounts={data.accounts}
            currencies={data.currencies}
            defaultRule={data.defaultRule}
            onBack={() => navigate('/onboarding/company')}
            onComplete={() => navigate('/onboarding/workflow')}
            organization={data.organization}
          />
        ) : null}
      </div>
    </OnboardingLayout>
  )
}
