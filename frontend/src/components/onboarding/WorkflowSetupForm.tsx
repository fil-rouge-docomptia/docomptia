import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, Info, LoaderCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ApiError } from '@/services/api'
import { updateValidationPreferences } from '@/services/onboarding'
import type { ValidationPreferences } from '@/types/onboarding'

type WorkflowPreset = 'amount' | 'none' | 'single'

type WorkflowSetupFormProps = {
  onBack: () => void
  onComplete: () => void
  preferences: ValidationPreferences
}

const presets: Array<{
  description: string
  label: string
  value: WorkflowPreset
}> = [
  {
    description: 'Invoices go directly to accounting after submission.',
    label: 'No approval',
    value: 'none',
  },
  {
    description: 'Every invoice requires one validation step.',
    label: 'Single approval step',
    value: 'single',
  },
  {
    description: 'Only invoices at or above a chosen amount require validation.',
    label: 'Approval based on amount',
    value: 'amount',
  },
]

function getInitialPreset(preferences: ValidationPreferences): WorkflowPreset {
  if (!preferences.validationRequired) {
    return 'none'
  }

  return preferences.validationThreshold === null ? 'single' : 'amount'
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return 'Unable to save the approval workflow. Please try again.'
  }

  if (error.status === 403) {
    return 'The organization management permission is required to update the approval workflow.'
  }

  return error.message
}

export function WorkflowSetupForm({
  onBack,
  onComplete,
  preferences,
}: WorkflowSetupFormProps) {
  const [preset, setPreset] = useState<WorkflowPreset>(() => getInitialPreset(preferences))
  const [threshold, setThreshold] = useState(
    preferences.validationThreshold === null ? '1000' : String(preferences.validationThreshold),
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [thresholdError, setThresholdError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setThresholdError(null)

    const normalizedThreshold = threshold.trim().replace(',', '.')
    const thresholdValue = Number(normalizedThreshold)

    if (
      preset === 'amount' &&
      (!/^\d+(?:\.\d{1,2})?$/.test(normalizedThreshold) || thresholdValue <= 0)
    ) {
      setThresholdError('Enter an amount greater than zero with at most two decimal places.')
      return
    }

    const update = preset === 'none'
      ? { validationRequired: false }
      : preset === 'single'
        ? { validationRequired: true }
        : { validationRequired: true, validationThreshold: thresholdValue }
    const hasChanged = update.validationRequired !== preferences.validationRequired ||
      ('validationThreshold' in update
        ? update.validationThreshold !== preferences.validationThreshold
        : preferences.validationThreshold !== null)

    if (!hasChanged) {
      onComplete()
      return
    }

    setIsSubmitting(true)

    try {
      await updateValidationPreferences(update)
      onComplete()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <p className="text-sm leading-5 text-muted-foreground">
        Choose a starting approval policy. Rules can be refined later in Settings.
      </p>

      <RadioGroup
        className="grid gap-3"
        disabled={isSubmitting}
        onValueChange={(value) => {
          setPreset(value as WorkflowPreset)
          setErrorMessage(null)
          setThresholdError(null)
        }}
        value={preset}
      >
        {presets.map((option) => (
          <Label
            className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-success-muted"
            htmlFor={`workflow-${option.value}`}
            key={option.value}
          >
            <RadioGroupItem id={`workflow-${option.value}`} value={option.value} />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium leading-5 text-foreground">{option.label}</span>
              <span className="text-xs font-normal leading-4 text-muted-foreground">
                {option.description}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>

      {preset === 'amount' ? (
        <div className="flex max-w-sm flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="validation-threshold">
            Approval threshold
          </Label>
          <div className="relative">
            <Input
              aria-describedby={thresholdError ? 'validation-threshold-error' : 'validation-threshold-help'}
              aria-invalid={Boolean(thresholdError)}
              className="h-11 pr-10 md:h-9"
              disabled={isSubmitting}
              id="validation-threshold"
              inputMode="decimal"
              onChange={(event) => {
                setThreshold(event.target.value)
                setThresholdError(null)
              }}
              value={threshold}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              €
            </span>
          </div>
          <p
            className={thresholdError ? 'text-xs text-destructive-text' : 'text-xs text-muted-foreground'}
            id={thresholdError ? 'validation-threshold-error' : 'validation-threshold-help'}
          >
            {thresholdError ?? 'Invoices below this amount skip validation.'}
          </p>
        </div>
      ) : null}

      {preset !== 'none' ? (
        <Alert className="border-info/20 bg-info-muted">
          <Info aria-hidden="true" className="size-4 text-info" />
          <AlertTitle>Approver assignment</AlertTitle>
          <AlertDescription>
            The backend does not yet support assigning a designated approver. Any user with
            validation permission can process invoices requiring approval.
          </AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
          <CircleAlert aria-hidden="true" className="size-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <Button disabled={isSubmitting} onClick={onBack} type="button" variant="outline">
          Back
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              Saving…
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </form>
  )
}
