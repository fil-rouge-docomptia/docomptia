import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const steps = ['Company', 'Accounting', 'Workflow', 'Team', 'Finish']

export function OnboardingProgress() {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-[600px] items-center justify-between gap-2">
          {steps.map((step, index) => (
            <li key={step}>
              <Badge
                aria-current={index === 0 ? 'step' : undefined}
                className="h-6 px-2.5 py-1 font-medium tracking-[0.1px]"
                variant={index === 0 ? 'default' : 'outline'}
              >
                {index + 1} {step}
              </Badge>
            </li>
          ))}
        </ol>
      </div>

      <Progress aria-label="Onboarding progress: step 1 of 5" className="h-2" value={20} />
    </div>
  )
}
