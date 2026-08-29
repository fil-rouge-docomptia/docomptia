import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress'

type OnboardingStepHeaderProps = {
  currentStep: number
  stepLabel: string
  title: string
}

export function OnboardingStepHeader({
  currentStep,
  stepLabel,
  title,
}: OnboardingStepHeaderProps) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold leading-7 tracking-[-0.25px]">{title}</h1>
        <p className="text-xs leading-4 text-muted-foreground">
          Step {currentStep} of 5 · {stepLabel}
        </p>
      </header>

      <OnboardingProgress currentStep={currentStep} />
    </>
  )
}
