import { useId } from 'react'
import { SearchableCombobox } from '@/components/onboarding/SearchableCombobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AccountingLineDraft } from './accounting-line-draft'
import type { ChartOfAccount } from '@/types/onboarding'
import type { Classification } from '@/types/classification'

export function AccountingLineFields({ draft, onChange, accounts, classifications, disabled = false }: {
  draft: AccountingLineDraft; onChange: (draft: AccountingLineDraft) => void
  accounts: ChartOfAccount[]; classifications: Classification[]; disabled?: boolean
}) {
  const id = useId()
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <div className="space-y-1.5"><Label htmlFor={`${id}-account`}>Account</Label>
      <SearchableCombobox ariaLabel="Account" id={`${id}-account`} disabled={disabled} value={draft.accountId}
        onValueChange={(accountId) => onChange({ ...draft, accountId })} options={accounts.map((account) => ({ value: String(account.accountId), label: `${account.accountNumber} — ${account.accountLabel}` }))}
        placeholder="Select an account" emptyMessage="No active accounts found." searchPlaceholder="Search account number or label…" />
    </div>
    <div className="space-y-1.5"><Label htmlFor={`${id}-label`}>Line label</Label><Input id={`${id}-label`} maxLength={255} disabled={disabled} value={draft.lineLabel} onChange={(event) => onChange({ ...draft, lineLabel: event.target.value })} /></div>
    {(['debitAmount', 'creditAmount', 'vatRate'] as const).map((field) => <div className="space-y-1.5" key={field}>
      <Label htmlFor={`${id}-${field}`}>{field === 'debitAmount' ? 'Debit amount' : field === 'creditAmount' ? 'Credit amount' : 'VAT rate (%)'}</Label>
      <Input id={`${id}-${field}`} inputMode="decimal" disabled={disabled} value={draft[field]} onChange={(event) => onChange({ ...draft, [field]: event.target.value })} placeholder={field === 'vatRate' ? 'Not provided' : '0.00'} />
    </div>)}
    <div className="space-y-1.5"><Label htmlFor={`${id}-classification`}>Analytic allocation</Label>
      <SearchableCombobox ariaLabel="Analytic allocation" id={`${id}-classification`} disabled={disabled} value={draft.classificationId || 'none'}
        onValueChange={(value) => onChange({ ...draft, classificationId: value === 'none' ? '' : value })}
        options={[{ value: 'none', label: 'No allocation' }, ...classifications.map((item) => ({ value: String(item.classificationId), label: `${item.name} · ${item.type}` }))]}
        placeholder="No allocation" emptyMessage="No active allocations found." searchPlaceholder="Search allocations…" />
    </div>
  </div>
}
