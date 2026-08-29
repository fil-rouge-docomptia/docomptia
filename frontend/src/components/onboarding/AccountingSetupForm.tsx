import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, Info, LoaderCircle } from 'lucide-react'

import { SearchableCombobox } from '@/components/onboarding/SearchableCombobox'
import type { ComboboxOption } from '@/components/onboarding/SearchableCombobox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/services/api'
import { updateAccountingRule } from '@/services/onboarding'
import { updateCurrentOrganization } from '@/services/organization'
import type { Organization } from '@/types/organization'
import type {
  AccountingRule,
  AccountingRuleUpdate,
  ChartOfAccount,
  ReferenceItem,
} from '@/types/onboarding'

type AccountingSetupFormProps = {
  accounts: ChartOfAccount[]
  currencies: ReferenceItem[]
  defaultRule: AccountingRule | null
  onBack: () => void
  onComplete: () => void
  organization: Organization
}

type AccountField = 'expenseAccountId' | 'supplierAccountId' | 'vatAccountId'

function getAccountOptions(accounts: ChartOfAccount[], accountType: string): ComboboxOption[] {
  const matchingAccounts = accounts.filter(
    (account) => account.active && account.accountType === accountType,
  )
  const availableAccounts = matchingAccounts.length > 0
    ? matchingAccounts
    : accounts.filter((account) => account.active)

  return availableAccounts.map((account) => ({
    label: `${account.accountNumber} · ${account.accountLabel}`,
    value: String(account.accountId),
  }))
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return 'Unable to save the accounting setup. Please try again.'
  }

  if (error.status === 403) {
    return 'Only an organization administrator can update the accounting setup.'
  }

  return error.message
}

export function AccountingSetupForm({
  accounts,
  currencies,
  defaultRule,
  onBack,
  onComplete,
  organization,
}: AccountingSetupFormProps) {
  const [currencyCode, setCurrencyCode] = useState(organization.defaultCurrencyCode ?? 'EUR')
  const [accountIds, setAccountIds] = useState<Record<AccountField, string>>({
    expenseAccountId: defaultRule?.expenseAccount
      ? String(defaultRule.expenseAccount.accountId)
      : '',
    supplierAccountId: defaultRule?.supplierAccount
      ? String(defaultRule.supplierAccount.accountId)
      : '',
    vatAccountId: defaultRule?.vatAccount ? String(defaultRule.vatAccount.accountId) : '',
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const currencyOptions = currencies.map((currency) => ({
    label: `${currency.code} · ${currency.label}`,
    value: currency.code,
  }))
  const expenseAccountOptions = getAccountOptions(accounts, 'CHARGE')
  const vatAccountOptions = getAccountOptions(accounts, 'ACTIF')
  const supplierAccountOptions = getAccountOptions(accounts, 'PASSIF')
  const hasActiveAccounts = accounts.some((account) => account.active)

  function updateAccount(field: AccountField, value: string) {
    setAccountIds((currentIds) => ({ ...currentIds, [field]: value }))
    setErrorMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const updates: Promise<unknown>[] = []

    if (currencyCode !== organization.defaultCurrencyCode) {
      updates.push(updateCurrentOrganization({ defaultCurrencyCode: currencyCode }))
    }

    if (defaultRule) {
      const ruleUpdate: AccountingRuleUpdate = {}

      for (const field of Object.keys(accountIds) as AccountField[]) {
        const selectedAccountId = Number(accountIds[field])
        const currentAccountId = defaultRule[field.replace('Id', '') as
          | 'expenseAccount'
          | 'supplierAccount'
          | 'vatAccount']?.accountId

        if (selectedAccountId && selectedAccountId !== currentAccountId) {
          ruleUpdate[field] = selectedAccountId
        }
      }

      if (Object.keys(ruleUpdate).length > 0) {
        updates.push(updateAccountingRule(defaultRule.accountingRuleId, ruleUpdate))
      }
    }

    try {
      await Promise.all(updates)
      onComplete()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <Alert className="border-info/20 bg-info-muted">
        <Info aria-hidden="true" className="size-4 text-info" />
        <AlertTitle>Accounting defaults</AlertTitle>
        <AlertDescription>
          These values can be adjusted later in Settings. Fiscal year configuration is not yet
          exposed by the backend.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-2">
        <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="default-currency">
          Default currency
        </Label>
        <SearchableCombobox
          disabled={isSubmitting}
          emptyMessage="No currency found."
          id="default-currency"
          onValueChange={(value) => {
            setCurrencyCode(value)
            setErrorMessage(null)
          }}
          options={currencyOptions}
          placeholder="Choose a currency"
          searchPlaceholder="Search currencies…"
          value={currencyCode}
        />
      </div>

      {defaultRule && hasActiveAccounts ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-8">
          <div className="flex flex-col gap-2 md:col-span-2">
            <p className="text-xs text-muted-foreground">
              Defaults applied to “{defaultRule.ruleName}”.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="supplier-account">
              Default supplier account
            </Label>
            <SearchableCombobox
              disabled={isSubmitting}
              emptyMessage="No supplier account found."
              id="supplier-account"
              onValueChange={(value) => updateAccount('supplierAccountId', value)}
              options={supplierAccountOptions}
              placeholder="Choose a supplier account"
              searchPlaceholder="Search accounts…"
              value={accountIds.supplierAccountId}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="vat-account">
              Default VAT account
            </Label>
            <SearchableCombobox
              disabled={isSubmitting}
              emptyMessage="No VAT account found."
              id="vat-account"
              onValueChange={(value) => updateAccount('vatAccountId', value)}
              options={vatAccountOptions}
              placeholder="Choose a VAT account"
              searchPlaceholder="Search accounts…"
              value={accountIds.vatAccountId}
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="expense-account">
              Default expense account
            </Label>
            <SearchableCombobox
              disabled={isSubmitting}
              emptyMessage="No expense account found."
              id="expense-account"
              onValueChange={(value) => updateAccount('expenseAccountId', value)}
              options={expenseAccountOptions}
              placeholder="Choose an expense account"
              searchPlaceholder="Search accounts…"
              value={accountIds.expenseAccountId}
            />
          </div>
        </div>
      ) : null}

      <Alert className="border-warning/30 bg-warning-muted">
        <CircleAlert aria-hidden="true" className="size-4 text-warning" />
        <AlertTitle>Chart of accounts import</AlertTitle>
        <AlertDescription>
          The backend import service is not available yet. You can continue and configure the
          chart of accounts later; this step will not create any account automatically.
        </AlertDescription>
      </Alert>

      {!defaultRule && hasActiveAccounts ? (
        <Alert>
          <CircleAlert aria-hidden="true" className="size-4" />
          <AlertDescription>
            No accounting rule can currently receive the selected default accounts.
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
