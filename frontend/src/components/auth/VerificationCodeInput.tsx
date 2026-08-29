import type { ChangeEvent } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const CODE_LENGTH = 6

type VerificationCodeInputProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
}

export function VerificationCodeInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
}: VerificationCodeInputProps) {
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => value[index] ?? '')

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
  }

  return (
    <div
      className={cn(
        'relative rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        invalid && 'focus-within:ring-destructive',
      )}
    >
      <Input
        aria-invalid={invalid}
        aria-label="Verification code"
        autoComplete="one-time-code"
        className="absolute inset-0 z-10 h-full cursor-text opacity-0"
        disabled={disabled}
        inputMode="numeric"
        maxLength={CODE_LENGTH}
        onChange={handleChange}
        pattern="[0-9]{6}"
        value={value}
      />

      <div aria-hidden="true" className="flex justify-between gap-2">
        {digits.map((digit, index) => (
          <span
            className={cn(
              'flex h-12 min-w-0 flex-1 items-center justify-center rounded-md border border-input bg-background text-center text-lg font-semibold md:h-14 md:text-xl',
              invalid && 'border-destructive-text text-destructive-text',
              disabled && 'cursor-not-allowed bg-muted text-muted-foreground opacity-50',
            )}
            key={index}
          >
            {digit}
          </span>
        ))}
      </div>
    </div>
  )
}
