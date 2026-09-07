import { useEffect, useId, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'

import { SearchableCombobox } from '@/components/onboarding/SearchableCombobox'
import type { ComboboxOption } from '@/components/onboarding/SearchableCombobox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/services/api'
import { correctAccountingEntryLine } from '@/services/invoice'
import { getChartOfAccounts } from '@/services/onboarding'
import type {
  AccountingEntry,
  AccountingEntryLine,
  AccountingEntryLineCorrectionRequest,
} from '@/types/invoice'
import type { ChartOfAccount } from '@/types/onboarding'

type LineDraft = {
  accountId: string
  creditAmount: string
  debitAmount: string
  lineLabel: string
}

type AccountingEntryLineEditorProps = {
  entryId: number
  line: AccountingEntryLine
  onCancel: () => void
  onEntryUpdated: (entry: AccountingEntry) => void
}

const amountPattern = /^\d{1,10}(?:\.\d{1,2})?$/

function amountsMatch(first: string, second: string) {
  return Number(first) === Number(second)
}

function getDraft(line: AccountingEntryLine): LineDraft {
  return {
    accountId: '',
    creditAmount: line.creditAmount,
    debitAmount: line.debitAmount,
    lineLabel: line.lineLabel,
  }
}

function getDraftError(draft: LineDraft) {
  if (!draft.lineLabel.trim()) {
    return 'The line label is required.'
  }

  if (!amountPattern.test(draft.debitAmount.trim())) {
    return 'Debit must be a non-negative amount with up to 10 digits and 2 decimals.'
  }

  if (!amountPattern.test(draft.creditAmount.trim())) {
    return 'Credit must be a non-negative amount with up to 10 digits and 2 decimals.'
  }

  return null
}

function getCorrection(
  accounts: ChartOfAccount[],
  draft: LineDraft,
  line: AccountingEntryLine,
): AccountingEntryLineCorrectionRequest {
  const correction: AccountingEntryLineCorrectionRequest = {}
  const selectedAccount = accounts.find(
    (account) => String(account.accountId) === draft.accountId,
  )
  const lineLabel = draft.lineLabel.trim()
  const debitAmount = draft.debitAmount.trim()
  const creditAmount = draft.creditAmount.trim()

  if (selectedAccount && selectedAccount.accountNumber !== line.accountNumber) {
    correction.accountId = selectedAccount.accountId
  }
  if (lineLabel !== line.lineLabel) {
    correction.lineLabel = lineLabel
  }
  if (!amountsMatch(debitAmount, line.debitAmount)) {
    correction.debitAmount = debitAmount
  }
  if (!amountsMatch(creditAmount, line.creditAmount)) {
    correction.creditAmount = creditAmount
  }

  return correction
}

function getCorrectionErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return 'Your changes are still available. Please try again.'
  }

  if (error.status === 409) {
    return error.message || 'This accounting entry can no longer be modified.'
  }

  if (error.status === 400) {
    return error.message || 'Check the line values and try again.'
  }

  if (error.status === 404) {
    return 'This accounting line no longer exists. Reload the invoice and try again.'
  }

  if (error.status === 403) {
    return 'You do not have permission to correct accounting entries.'
  }

  return 'Your changes are still available. Please try again.'
}

export function AccountingEntryLineEditor({
  entryId,
  line,
  onCancel,
  onEntryUpdated,
}: AccountingEntryLineEditorProps) {
  const accountInputId = useId()
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [accountsError, setAccountsError] = useState(false)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsRetryCount, setAccountsRetryCount] = useState(0)
  const [draft, setDraft] = useState(() => getDraft(line))
  const [saveState, setSaveState] = useState<{
    message: string
    status: 'idle' | 'saving' | 'error'
  }>({ message: '', status: 'idle' })

  useEffect(() => {
    let active = true

    getChartOfAccounts()
      .then((chartOfAccounts) => {
        if (!active) {
          return
        }

        const activeAccounts = chartOfAccounts.filter((account) => account.active)
        const currentAccount = activeAccounts.find(
          (account) => account.accountNumber === line.accountNumber,
        )
        setAccounts(activeAccounts)
        setDraft((currentDraft) => ({
          ...currentDraft,
          accountId: currentDraft.accountId || (
            currentAccount ? String(currentAccount.accountId) : ''
          ),
        }))
      })
      .catch(() => {
        if (active) {
          setAccountsError(true)
        }
      })
      .finally(() => {
        if (active) {
          setAccountsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [accountsRetryCount, line.accountNumber])

  const accountOptions: ComboboxOption[] = accounts.map((account) => ({
    label: `${account.accountNumber} — ${account.accountLabel}`,
    value: String(account.accountId),
  }))
  const draftError = getDraftError(draft)
  const correction = getCorrection(accounts, draft, line)
  const hasChanges = Object.keys(correction).length > 0
  const saving = saveState.status === 'saving'

  const updateDraft = (update: Partial<LineDraft>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...update }))
    setSaveState({ message: '', status: 'idle' })
  }

  const handleSave = async () => {
    if (draftError || !hasChanges) {
      setSaveState({
        message: draftError ?? 'Change at least one field before saving.',
        status: 'error',
      })
      return
    }

    setSaveState({ message: '', status: 'saving' })

    try {
      const updatedEntry = await correctAccountingEntryLine(
        entryId,
        line.accountingEntryLineId,
        correction,
      )
      toast.success('Accounting line saved', {
        description: `Line ${line.lineNumber} was updated and the balance was recalculated.`,
      })
      onEntryUpdated(updatedEntry)
    } catch (saveError) {
      setSaveState({ message: getCorrectionErrorMessage(saveError), status: 'error' })
    }
  }

  return (
    <>
      <tr className="border-t border-border bg-info-muted/30 align-top">
        <td className="px-3 py-3">
          <SearchableCombobox
            ariaLabel="Account"
            disabled={accountsLoading || accountsError || saving}
            emptyMessage="No active accounts found."
            id={accountInputId}
            onValueChange={(accountId) => updateDraft({ accountId })}
            options={accountOptions}
            placeholder={accountsLoading ? 'Loading accounts…' : 'Select an account'}
            searchPlaceholder="Search account number or label…"
            value={draft.accountId}
          />
          {accountsError ? (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs text-destructive">Unable to load accounts.</p>
              <Button
                className="h-auto px-1 py-0 text-xs"
                onClick={() => {
                  setAccountsError(false)
                  setAccountsLoading(true)
                  setAccountsRetryCount((count) => count + 1)
                }}
                type="button"
                variant="link"
              >
                Try again
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Current: {line.accountNumber} — {line.accountLabel}
            </p>
          )}
        </td>
        <td className="px-3 py-3">
          <Input
            aria-label="Line label"
            aria-invalid={!draft.lineLabel.trim()}
            disabled={saving}
            onChange={(event) => updateDraft({ lineLabel: event.target.value })}
            value={draft.lineLabel}
          />
        </td>
        <td className="px-3 py-3">
          <Input
            aria-label="Debit amount"
            aria-invalid={!amountPattern.test(draft.debitAmount.trim())}
            className="text-right tabular-nums"
            disabled={saving}
            inputMode="decimal"
            onChange={(event) => updateDraft({ debitAmount: event.target.value })}
            value={draft.debitAmount}
          />
        </td>
        <td className="px-3 py-3">
          <Input
            aria-label="Credit amount"
            aria-invalid={!amountPattern.test(draft.creditAmount.trim())}
            className="text-right tabular-nums"
            disabled={saving}
            inputMode="decimal"
            onChange={(event) => updateDraft({ creditAmount: event.target.value })}
            value={draft.creditAmount}
          />
        </td>
        <td className="px-3 py-3">
          <div className="flex justify-end gap-2">
            <Button
              disabled={!hasChanges || saving}
              onClick={() => void handleSave()}
              size="sm"
              type="button"
            >
              {saving ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              Save
            </Button>
            <Button
              disabled={saving}
              onClick={onCancel}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
          {draftError ? (
            <p className="mt-2 max-w-48 text-right text-xs text-destructive">
              {draftError}
            </p>
          ) : null}
        </td>
      </tr>
      {saveState.status === 'error' ? (
        <tr className="border-t border-border">
          <td className="p-3" colSpan={5}>
            <Alert variant="destructive">
              <AlertTitle>Unable to save accounting line</AlertTitle>
              <AlertDescription>{saveState.message}</AlertDescription>
            </Alert>
          </td>
        </tr>
      ) : null}
    </>
  )
}
