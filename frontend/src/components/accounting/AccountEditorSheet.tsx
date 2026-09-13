import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'

import { AccountMutationError } from '@/components/accounting/AccountMutationError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ApiError } from '@/services/api'
import { createAccount, updateAccount } from '@/services/chart-of-accounts'
import type { ChartOfAccount, ChartOfAccountInput } from '@/types/onboarding'

type AccountEditorSheetProps = {
  account?: ChartOfAccount
  duplicateOf?: ChartOfAccount
  accountTypes: string[]
  onClose: () => void
  onSaved: (account: ChartOfAccount) => void
  onRestoreFocus: () => void
}

const fields = [
  { key: 'accountNumber', label: 'Account number', placeholder: 'e.g. 401000' },
  { key: 'accountLabel', label: 'Label', placeholder: 'e.g. Suppliers' },
  { key: 'accountType', label: 'Type', placeholder: 'Enter an account type' },
] as const

export function AccountEditorSheet({ account, duplicateOf, accountTypes, onClose, onSaved, onRestoreFocus }: AccountEditorSheetProps) {
  const id = useId()
  const [input, setInput] = useState<ChartOfAccountInput>({ accountNumber: account?.accountNumber ?? '', accountLabel: account?.accountLabel ?? duplicateOf?.accountLabel ?? '', accountType: account?.accountType ?? duplicateOf?.accountType ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const request = useRef<AbortController | null>(null)
  const numberInput = useRef<HTMLInputElement>(null)
  const denied = error instanceof ApiError && [403, 404].includes(error.status)
  const conflict = error instanceof ApiError && error.status === 409
  const normalized = { accountNumber: input.accountNumber.trim(), accountLabel: input.accountLabel.trim(), accountType: input.accountType.trim() }
  const changes: Partial<ChartOfAccountInput> = {}
  for (const { key } of fields) if (normalized[key] !== account?.[key]) changes[key] = normalized[key]
  const valid = fields.every(({ key }) => Boolean(normalized[key])) && Object.keys(changes).length > 0

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { if (conflict && !saving) numberInput.current?.focus() }, [conflict, saving])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || request.current || denied) return
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    try {
      const saved = account
        ? await updateAccount(account.accountId, changes, controller.signal)
        : await createAccount(normalized, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error)
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <Sheet onOpenChange={(open) => { if (!open && !request.current) onClose() }} open>
      <SheetContent
        className="flex w-full flex-col overflow-y-auto sm:max-w-[408px] [&>button]:size-11 [&>button]:right-2 [&>button]:top-2"
        onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus() }}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="pr-8 text-xl tracking-[-0.25px]">{account ? 'Edit account' : duplicateOf ? 'Duplicate account' : 'Add account'}</SheetTitle>
          <SheetDescription className="text-xs">{account ? 'Update the account information while keeping its existing references.' : duplicateOf ? `Create a new active account from ${duplicateOf.accountNumber}. Choose a unique number; history and references remain with the original.` : 'Create an account used to generate accounting entries.'}</SheetDescription>
        </SheetHeader>
        <form aria-label={account ? 'Edit account' : duplicateOf ? 'Duplicate account' : 'Add account'} aria-busy={saving} className="flex flex-1 flex-col gap-6" onSubmit={(event) => void save(event)}>
          <div className="space-y-4">
            {fields.map(({ key, label, placeholder }) => (
              <div className="space-y-2" key={key}>
                <Label className="text-xs" htmlFor={`${id}-${key}`}>{label} <span aria-hidden="true" className="text-destructive">*</span></Label>
                <Input
                  aria-describedby={key === 'accountNumber' && conflict ? `${id}-conflict` : key === 'accountType' ? `${id}-type-hint` : undefined}
                  aria-invalid={key === 'accountNumber' && conflict}
                  className="h-11 border-input sm:h-9"
                  disabled={saving || denied}
                  id={`${id}-${key}`}
                  list={key === 'accountType' ? `${id}-types` : undefined}
                  onChange={(event) => { setInput((current) => ({ ...current, [key]: event.target.value })); if (!conflict || key === 'accountNumber') setError(null) }}
                  placeholder={placeholder}
                  ref={key === 'accountNumber' ? numberInput : undefined}
                  required
                  value={input[key]}
                />
                {key === 'accountNumber' && conflict ? <p className="text-sm text-destructive" id={`${id}-conflict`} role="alert">This account number is already used in your organization. Choose another number.</p> : null}
              </div>
            ))}
            <datalist id={`${id}-types`}>{accountTypes.map((type) => <option key={type} value={type} />)}</datalist>
            <p className="text-xs text-muted-foreground" id={`${id}-type-hint`}>Use a type from your chart of accounts, or enter a new one.</p>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>Status</span>
              <Badge className={account?.active === false ? 'bg-muted text-muted-foreground' : 'bg-success-muted text-success'} variant="secondary">{account?.active === false ? 'Inactive' : 'Active'}</Badge>
            </div>
            {!account ? <p className="text-xs text-muted-foreground">New accounts are active when created.</p> : null}
          </div>
          {!conflict ? <AccountMutationError error={error} /> : null}
          <SheetFooter className="mt-auto flex-row justify-end gap-2 pt-6 sm:space-x-0">
            <Button disabled={saving} onClick={onClose} type="button" variant="secondary">Cancel</Button>
            <Button disabled={!valid || saving || denied} type="submit">
              {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : !account ? <Plus aria-hidden="true" /> : null}
              {saving ? 'Saving…' : account ? 'Save changes' : 'Add account'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
