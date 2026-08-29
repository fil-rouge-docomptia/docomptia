import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const steps = ['Company', 'Accounting', 'Workflow', 'Team', 'Finish']

type OnboardingProgressProps = {
  currentStep: number
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-[600px] items-center justify-between gap-2">
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isReached = stepNumber <= currentStep

            return <li key={step}>
              <Badge
                aria-current={stepNumber === currentStep ? 'step' : undefined}
                className={cn(
                  'h-6 px-2.5 py-1 font-medium tracking-[0.1px]',
                  currentStep === 5 && stepNumber === 5 &&
                    'border-transparent bg-success-muted text-success',
                )}
                variant={isReached ? 'default' : 'outline'}
              >
                {stepNumber} {step}
              </Badge>
            </li>
          })}
        </ol>
      </div>

      <Progress
        aria-label={`Onboarding progress: step ${currentStep} of 5`}
        className="h-2"
        value={currentStep * 20}
      />
    </div>
  )
}
