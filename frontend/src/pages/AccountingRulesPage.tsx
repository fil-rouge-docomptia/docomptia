import { useEffect, useState } from 'react'
import { AlertCircle, ListFilter, Plus, Search, Upload } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { accountLabel, ruleAccountFields } from '@/components/accounting/accounting-rule-utils'
import { RulePriority, RuleStatus } from '@/components/accounting/AccountingRuleBadges'
import { AccountingRuleEditor } from '@/components/accounting/AccountingRuleEditor'
import { AccountingSectionTabs } from '@/components/accounting/AccountingSectionTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { ApiError } from '@/services/api'
import { getAccountingRules } from '@/services/onboarding'
import type { AccountingRule } from '@/types/onboarding'

export default function AccountingRulesPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [retry, setRetry] = useState(0)
  const identity = `${user?.id}:${user?.organization.id}:${user?.role.code}`
  const requestKey = `${identity}:${retry}`
  const [result, setResult] = useState<{
    key: string
    rules: AccountingRule[] | null
    error: unknown
  } | null>(null)
  const current = result?.key === requestKey ? result : null
  const rules = current?.rules
  const query = (params.get('query') ?? '').slice(0, 200)
  const status = ['active', 'inactive'].includes(params.get('status') ?? '') ? params.get('status')! : 'all'
  const visibleRules = rules?.filter((rule) => (
    (status === 'all' || rule.active === (status === 'active'))
    && [rule.ruleName, ...ruleAccountFields.map((field) => accountLabel(rule[field.key]))]
      .some((text) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  )) ?? []
  const rawId = params.get('rule')
  const selected = rawId === null ? visibleRules[0] : visibleRules.find((rule) => String(rule.accountingRuleId) === rawId)
  const selectedId = selected?.accountingRuleId
  const canEdit = user?.role.code === 'ADMIN'

  useEffect(() => {
    const controller = new AbortController()
    getAccountingRules(controller.signal)
      .then((rules) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, rules, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, rules: null, error })
      })
    return () => controller.abort()
  }, [requestKey])

  useEffect(() => {
    if (rawId !== null && selectedId !== undefined) document.getElementById('rule-editor-title')?.focus()
  }, [rawId, selectedId])

  function filter(key: 'query' | 'status', value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('rule')
      if (value && (key === 'query' || value !== 'all')) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: key === 'query' })
  }

  function selectRule(rule: AccountingRule) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('rule', String(rule.accountingRuleId))
      return next
    })
    if (rawId === String(rule.accountingRuleId)) document.getElementById('rule-editor-title')?.focus()
  }

  let content
  if (current?.error) {
    const forbidden = current.error instanceof ApiError && current.error.status === 403
    const unavailable = current.error instanceof ApiError && [404, 405, 501].includes(current.error.status)
    content = (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>{forbidden ? 'Accounting rules access denied' : unavailable ? 'Accounting rules unavailable' : 'Unable to load accounting rules'}</AlertTitle>
        <AlertDescription>
          <p>{forbidden ? 'You do not have access to the accounting rules of this organization.'
            : unavailable ? 'Accounting rules are not available at the moment.' : 'Check your connection, then try again.'}</p>
          {!forbidden && !unavailable ? <Button className="mt-3" onClick={() => setRetry((value) => value + 1)} variant="outline">Try again</Button> : null}
        </AlertDescription>
      </Alert>
    )
  } else if (!rules) {
    content = (
      <div aria-label="Loading accounting rules" className="grid gap-4 xl:grid-cols-[minmax(0,400fr)_minmax(0,688fr)]" role="status">
        <span className="sr-only">Loading accounting rules</span>
        <Skeleton className="h-72 w-full" /><Skeleton className="h-96 w-full" />
      </div>
    )
  } else if (visibleRules.length === 0) {
    content = (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
        <ListFilter aria-hidden="true" className="mb-4 size-8 text-muted-foreground" />
        <h2 className="font-semibold">{rules.length === 0 ? 'No accounting rules yet' : 'No matching rules'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {rules.length === 0 ? 'The rules configured for your organization will appear here.' : 'Try another search or clear your filters.'}
        </p>
      </div>
    )
  } else {
    content = (
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,400fr)_minmax(0,688fr)]">
        <section aria-labelledby="rules-list-title" className="min-w-0 rounded-lg border border-border p-4 xl:min-h-[704px]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold" id="rules-list-title">Accounting rules</h2>
            <Badge className="bg-success-muted text-success" variant="secondary">{rules.filter((rule) => rule.active).length} active</Badge>
          </div>
          <p className="mb-3 mt-2 border-b border-border pb-4 text-xs text-muted-foreground">Rules are listed in their evaluation order.</p>
          <ul className="space-y-3">
            {visibleRules.map((rule) => (
              <li className={cn('space-y-3 rounded-lg border border-border p-4', selected?.accountingRuleId === rule.accountingRuleId && 'border-primary/40 bg-accent/30')} key={rule.accountingRuleId}>
                <h3 className="break-words font-semibold">{rule.ruleName}</h3>
                <p className="break-words text-xs text-muted-foreground">Expense · {accountLabel(rule.expenseAccount)}</p>
                <div className="flex flex-wrap gap-2">
                  <RuleStatus active={rule.active} /><RulePriority rule={rule} />
                  {!rule.configurationComplete ? <Badge className="bg-warning-muted text-warning-muted-foreground" variant="outline">Needs configuration</Badge> : null}
                </div>
                <Button
                  aria-label={`${canEdit ? 'Edit' : 'View'} rule ${rule.ruleName}`}
                  aria-pressed={selected?.accountingRuleId === rule.accountingRuleId}
                  onClick={() => selectRule(rule)}
                  size="sm"
                  variant={selected?.accountingRuleId === rule.accountingRuleId ? 'default' : 'outline'}
                >
                  {canEdit ? 'Edit rule' : 'View rule'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
        {selected ? (
          <AccountingRuleEditor
            canEdit={canEdit}
            key={`${identity}:${JSON.stringify(selected)}`}
            onSaved={(saved) => {
              setResult((current) => current?.key === requestKey && current.rules
                ? { ...current, rules: current.rules.map((rule) => rule.accountingRuleId === saved.accountingRuleId ? saved : rule) }
                : current)
              toast.success('Accounting rule updated')
            }}
            rule={selected}
          />
        ) : (
          <Alert>
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Accounting rule not found</AlertTitle>
            <AlertDescription>Select an available rule from this organization to continue.</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        actions={canEdit ? <><Button disabled variant="secondary"><Upload aria-hidden="true" />Import rules</Button><Button disabled><Plus aria-hidden="true" />Create rule</Button></> : undefined}
        description="Review accounting rules and manage account assignments."
        title="Accounting"
      />
      <AccountingSectionTabs value="rules" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search rules" className="h-10 pl-9" maxLength={200} onChange={(event) => filter('query', event.target.value)} placeholder="Search rules…" type="search" value={query} />
        </div>
        <Select onValueChange={(value) => filter('status', value)} value={status}>
          <SelectTrigger aria-label="Rule status" className="h-10 w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
        </Select>
        {query || status !== 'all' ? <Button onClick={() => setParams({})} variant="ghost">Clear filters</Button> : null}
        {canEdit ? <Button className="sm:ml-auto" disabled variant="outline">Test all rules</Button> : null}
      </div>
      {content}
    </div>
  )
}
