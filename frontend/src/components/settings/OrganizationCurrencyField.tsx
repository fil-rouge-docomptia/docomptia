import { useEffect, useState } from 'react'

import { SearchableCombobox } from '@/components/onboarding/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getReferenceData } from '@/services/onboarding'
import type { ReferenceItem } from '@/types/onboarding'

type OrganizationCurrencyFieldProps = {
  disabled: boolean
  error?: string
  id: string
  onChange: (value: string) => void
  unavailableMessage?: string
  value: string
}

export function OrganizationCurrencyField({ disabled, error, id, onChange, value, unavailableMessage = 'Currencies are unavailable. You can still update your organization information.' }: OrganizationCurrencyFieldProps) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ key: number, currencies: ReferenceItem[] | null } | null>(null)
  const current = result?.key === retry ? result : null
  const currencies = current?.currencies
  const unavailable = Boolean(current && !currencies?.length)

  useEffect(() => {
    const controller = new AbortController()
    getReferenceData(controller.signal)
      .then((data) => {
        const currencies = Array.isArray(data?.currencies) && data.currencies.every((currency) => (
          currency && typeof currency.code === 'string' && /^[A-Z]{3}$/.test(currency.code) && typeof currency.label === 'string'
        )) ? data.currencies : null
        if (!controller.signal.aborted) setResult({ key: retry, currencies })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: retry, currencies: null })
      })
    return () => controller.abort()
  }, [retry])

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs tracking-[0.1px]" htmlFor={id}>Currency</Label>
      <SearchableCombobox
        ariaDescribedBy={`${id}-description`}
        ariaInvalid={Boolean(error)}
        disabled={disabled || !currencies?.length}
        emptyMessage="No currency found."
        id={id}
        onValueChange={onChange}
        options={currencies?.map((currency) => ({ value: currency.code, label: `${currency.code} — ${currency.label}` })) ?? []}
        placeholder={value || 'Not configured'}
        searchPlaceholder="Search currencies…"
        value={value}
      />
      <p className={error ? 'text-xs text-destructive-text' : 'text-xs text-muted-foreground'} id={`${id}-description`}>
        {error ?? 'Default currency for new invoices.'}
      </p>
      {!current ? <p className="text-xs text-muted-foreground" role="status">Loading currencies…</p> : null}
      {unavailable ? (
        <div className="space-y-1 text-xs text-muted-foreground" role="status">
          <p>{unavailableMessage}</p>
          <Button className="h-11 px-0 md:h-9" onClick={() => setRetry((value) => value + 1)} type="button" variant="link">Retry currencies</Button>
        </div>
      ) : null}
    </div>
  )
}
