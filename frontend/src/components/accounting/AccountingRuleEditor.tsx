import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Info, LoaderCircle } from 'lucide-react'

import { accountLabel, ruleAccountFields } from '@/components/accounting/accounting-rule-utils'
import { RulePriority, RuleStatus } from '@/components/accounting/AccountingRuleBadges'
import { SearchableCombobox } from '@/components/onboarding/SearchableCombobox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getRuleAccountOptions } from '@/services/accounting-rules'
import { ApiError } from '@/services/api'
import { updateAccountingRule } from '@/services/onboarding'
import type { AccountingRule, AccountingRuleUpdate, ChartOfAccount } from '@/types/onboarding'

type AccountingRuleEditorProps = {
  canEdit: boolean
  onSaved: (rule: AccountingRule) => void
  rule: AccountingRule
}

export function AccountingRuleEditor({ canEdit, onSaved, rule }: AccountingRuleEditorProps) {
  const [accountIds, setAccountIds] = useState({
    expenseAccountId: String(rule.expenseAccount?.accountId ?? ''),
    vatAccountId: String(rule.vatAccount?.accountId ?? ''),
    supplierAccountId: String(rule.supplierAccount?.accountId ?? ''),
  })
  const [retry, setRetry] = useState(0)
  const [accountResult, setAccountResult] = useState<{
    accounts: ChartOfAccount[] | null
    error: unknown
    retry: number
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<unknown>(null)
  const saveRequest = useRef<AbortController | null>(null)
  const current = accountResult?.retry === retry ? accountResult : null
  const accounts = current?.accounts
  const activeAccounts = accounts?.filter((account) => account.active) ?? []
  const options = activeAccounts.map((account) => ({ label: accountLabel(account), value: String(account.accountId) }))
  const update: AccountingRuleUpdate = {}
  for (const field of ruleAccountFields) {
    const id = Number(accountIds[field.updateKey])
    if (id > 0 && id !== rule[field.key]?.accountId) update[field.updateKey] = id
  }
  const changed = Object.keys(update).length > 0
  const permissionDenied = saveError instanceof ApiError && saveError.status === 403
  const missingRule = saveError instanceof ApiError && saveError.status === 404

  useEffect(() => {
    if (!canEdit) return
    const controller = new AbortController()
    getRuleAccountOptions(controller.signal)
      .then((accounts) => {
        if (!controller.signal.aborted) setAccountResult({ accounts, error: null, retry })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setAccountResult({ accounts: null, error, retry })
      })
    return () => controller.abort()
  }, [canEdit, retry])

  useEffect(() => () => saveRequest.current?.abort(), [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || !changed || !accounts || saveRequest.current || permissionDenied || missingRule) return
    if (Object.values(update).some((id) => !activeAccounts.some((account) => account.accountId === id))) return
    const controller = new AbortController()
    saveRequest.current = controller
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await updateAccountingRule(rule.accountingRuleId, update, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(error)
    } finally {
      if (!controller.signal.aborted) {
        saveRequest.current = null
        setSaving(false)
      }
    }
  }

  function reset() {
    setAccountIds({
      expenseAccountId: String(rule.expenseAccount?.accountId ?? ''),
      vatAccountId: String(rule.vatAccount?.accountId ?? ''),
      supplierAccountId: String(rule.supplierAccount?.accountId ?? ''),
    })
    setSaveError(null)
  }

  return (
    <section aria-labelledby="rule-editor-title" className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-4 xl:min-h-[704px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold" id="rule-editor-title" tabIndex={-1}>{rule.ruleName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Account assignments for this rule.</p>
        </div>
        <RuleStatus active={rule.active} />
      </div>
      <div className="my-4 flex flex-wrap gap-2 border-b border-border pb-4">
        <RulePriority rule={rule} />
        <span className="text-xs text-muted-foreground">{rule.configurationComplete ? 'Configuration complete' : 'Configuration incomplete'}</span>
      </div>
      {!rule.configurationComplete ? (
        <Alert className="mb-4 border-warning/30 bg-warning-muted">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Account configuration needs attention</AlertTitle>
          <AlertDescription>A required account is missing or inactive.</AlertDescription>
        </Alert>
      ) : null}
      {!canEdit ? (
        <>
          <Alert className="mb-4">
            <Info aria-hidden="true" />
            <AlertTitle>Read-only access</AlertTitle>
            <AlertDescription>Only an organization administrator can change account assignments.</AlertDescription>
          </Alert>
          <dl className="space-y-4 rounded-lg border border-border bg-muted p-4">
            {ruleAccountFields.map((field) => (
              <div key={field.key}>
                <dt className="text-xs font-medium">{field.label}</dt>
                <dd className="mt-1 break-words text-sm">{accountLabel(rule[field.key])}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <form aria-label="Edit accounting rule" className="flex flex-1 flex-col" onSubmit={(event) => void save(event)}>
          <div className="space-y-4 rounded-lg border border-border bg-muted p-4">
            <h3 className="font-semibold">Account assignments</h3>
            {ruleAccountFields.map((field) => (
              <div className="min-w-0 space-y-2" key={field.key}>
                <Label className="text-xs" htmlFor={`rule-${field.updateKey}`}>{field.label}</Label>
                <SearchableCombobox
                  disabled={!accounts || saving || permissionDenied || missingRule || activeAccounts.length === 0}
                  emptyMessage="No active account matches your search."
                  id={`rule-${field.updateKey}`}
                  onValueChange={(value) => {
                    setAccountIds((current) => ({ ...current, [field.updateKey]: value }))
                    setSaveError(null)
                  }}
                  options={options}
                  placeholder={accountLabel(rule[field.key])}
                  searchPlaceholder="Search account number or name…"
                  value={accountIds[field.updateKey]}
                />
              </div>
            ))}
          </div>
          {!current ? (
            <div aria-label="Loading account options" className="mt-4 space-y-2" role="status">
              <p className="text-xs text-muted-foreground">Loading the organization’s chart of accounts…</p>
              <Skeleton className="h-8 w-full" />
            </div>
          ) : current.error ? (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Account options unavailable</AlertTitle>
              <AlertDescription>
                <p>Your current assignments are preserved. Reload the chart of accounts to edit this rule.</p>
                <Button className="mt-3" onClick={() => setRetry((value) => value + 1)} type="button" variant="outline">Retry accounts</Button>
              </AlertDescription>
            </Alert>
          ) : activeAccounts.length === 0 ? (
            <Alert className="mt-4">
              <Info aria-hidden="true" />
              <AlertTitle>No active accounts available</AlertTitle>
              <AlertDescription>Active accounts are needed before account assignments can be changed.</AlertDescription>
            </Alert>
          ) : null}
          {saveError ? (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>{permissionDenied ? 'Editing access denied' : missingRule ? 'Rule no longer available' : 'Unable to save this rule'}</AlertTitle>
              <AlertDescription>
                {permissionDenied ? 'Administrator access is required. Reload the page after your access has been restored.'
                  : missingRule ? 'This rule is no longer available in your organization. Reload the list to continue.'
                    : saveError instanceof ApiError && saveError.status === 400 ? 'Choose active accounts from your organization, then try again.'
                      : 'Your changes have not been confirmed. Check your connection and try again.'}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
            <Button disabled={!changed || saving || permissionDenied || missingRule} onClick={reset} type="button" variant="outline">Reset changes</Button>
            <Button disabled={!changed || !accounts || saving || permissionDenied || missingRule} type="submit">
              {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
