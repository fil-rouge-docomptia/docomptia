import { useEffect, useId, useState } from 'react'
import { SearchableCombobox } from '@/components/onboarding/SearchableCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAccountingCandidates } from '@/services/accounting'
import type { AccountingCandidate, AccountingCandidatePage } from '@/types/accounting'

export function AccountingInvoicePicker({ value, onChange, disabled }: {
  value: AccountingCandidate | null; onChange: (value: AccountingCandidate) => void; disabled: boolean
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  const key = `${query}:${page}:${retry}`
  const [result, setResult] = useState<{ key: string; data: AccountingCandidatePage | null; error: boolean } | null>(null)
  const current = result?.key === key ? result : null
  useEffect(() => {
    const controller = new AbortController()
    getAccountingCandidates(query, page, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data, error: false })
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, data: null, error: true })
    })
    return () => controller.abort()
  }, [query, page, key])
  const candidates = current?.data?.content ?? []
  const options = value && !candidates.some((item) => item.invoiceId === value.invoiceId) ? [value, ...candidates] : candidates
  return <div className="space-y-2 rounded-lg border border-border p-4">
    <Label htmlFor={`${id}-search`}>Find a validated supplier invoice</Label>
    <Input id={`${id}-search`} disabled={disabled} maxLength={200} value={query} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Search invoice number or supplier…" />
    <SearchableCombobox ariaLabel="Invoice" id={`${id}-invoice`} value={value ? String(value.invoiceId) : ''} disabled={disabled || !current?.data}
      onValueChange={(id) => { const selected = options.find((item) => String(item.invoiceId) === id); if (selected) onChange(selected) }}
      options={options.map((item) => ({ value: String(item.invoiceId), label: `${item.invoiceNumber ?? `Invoice #${item.invoiceId}`} — ${item.supplierName}` }))}
      placeholder={current ? 'Select an eligible invoice' : 'Loading eligible invoices…'} emptyMessage="No eligible invoices found." searchPlaceholder="Filter this page…" />
    {current?.error ? <p role="alert" className="text-sm text-destructive">Unable to load eligible invoices. <Button type="button" variant="link" onClick={() => setRetry((value) => value + 1)}>Retry invoices</Button></p> : null}
    {current?.data?.totalElements === 0 ? <p className="text-sm text-muted-foreground">No validated supplier invoice without an original entry matches this search.</p> : null}
    {current?.data && current.data.totalPages > 1 ? <div className="flex items-center justify-between gap-2 text-xs"><Button type="button" variant="outline" disabled={disabled || page === 0} onClick={() => setPage((value) => value - 1)}>Previous invoices</Button><span>Page {page + 1} of {current.data.totalPages}</span><Button type="button" variant="outline" disabled={disabled || page + 1 >= current.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next invoices</Button></div> : null}
    <p className="text-xs text-muted-foreground">Only validated supplier invoices without an original entry or pending duplicate alert are available.</p>
  </div>
}
