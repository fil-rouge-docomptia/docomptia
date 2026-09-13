import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { AccountingEntryLineEditor } from '@/components/invoice/detail/AccountingEntryLineEditor'
import { formatInvoiceMoney } from '@/components/invoice/detail/invoice-detail-utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { mutateAccountingLine } from '@/services/accounting'
import { ApiError } from '@/services/api'
import type { AccountingEntry, AccountingDiagnostic } from '@/types/invoice'

export function AccountingEntryLines({ entry, currency, canEdit, diagnostics = [], onSaved, onReload, onCloseGuardChange }: {
  entry: AccountingEntry; currency: string | null; canEdit: boolean; diagnostics?: AccountingDiagnostic[]
  onCloseGuardChange?: (guard: (() => boolean) | null) => void
  onSaved: (entry: AccountingEntry) => Promise<void>; onReload: () => Promise<void>
}) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const targeted = entry.lines.filter((line) => selected.includes(line.accountingEntryLineId))
  async function saved(updated: AccountingEntry) { await onSaved(updated); setEditing(null); setSelected([]) }
  async function remove() {
    if (request.current || entry.version === undefined) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(null)
    let version = entry.version
    let updated = entry
    try {
      for (const line of targeted) {
        updated = await mutateAccountingLine(entry.accountingEntryId, line.accountingEntryLineId, 'DELETE', undefined, version, crypto.randomUUID(), controller.signal)
        version = updated.version!
      }
      if (!controller.signal.aborted) { await saved(updated); setConfirm(false) }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof ApiError ? `${cause.message} Reload the entry before another removal.` : 'Removal could not be confirmed. Reload the entry before trying again.')
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setPending(false) }
    }
  }
  return <section aria-label="Accounting lines" className="min-w-0 space-y-3">
    {canEdit ? <div className="flex flex-wrap items-center justify-end gap-2">
      <Button disabled={editing !== null || pending} onClick={() => setEditing('new')} variant="outline"><Plus aria-hidden="true" />Add line</Button>
      {targeted.length ? <Button disabled={editing !== null || pending} onClick={() => { setError(null); setConfirm(true) }} variant="outline"><Trash2 aria-hidden="true" />Remove {targeted.length} selected</Button> : null}
    </div> : null}
    <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[48rem] text-left text-sm" aria-label="Entry lines">
        <thead className="bg-muted text-xs text-muted-foreground"><tr>
          {canEdit ? <th className="p-3"><Checkbox aria-label="Select all accounting lines" disabled={editing !== null} checked={targeted.length === entry.lines.length && targeted.length > 0 ? true : targeted.length > 0 ? 'indeterminate' : false}
            onCheckedChange={(checked) => setSelected(checked ? entry.lines.map((line) => line.accountingEntryLineId) : [])} /></th> : null}
          <th className="p-3">Account</th><th className="p-3">Label</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th><th className="p-3">VAT · analytics</th>{canEdit ? <th className="p-3" aria-label="Actions" /> : null}
        </tr></thead>
        <tbody>
          {entry.lines.map((line) => editing === line.accountingEntryLineId ?
            <tr key={line.accountingEntryLineId} className="border-t border-border bg-info-muted/30"><td className="p-3 text-sm" colSpan={7}>Editing line {line.lineNumber}: {line.accountNumber} — {line.lineLabel}</td></tr> :
            <tr className={`border-t border-border ${diagnostics.some((item) => item.blocking && item.accountingEntryLineId === line.accountingEntryLineId) ? 'bg-warning-muted' : ''}`} key={line.accountingEntryLineId}>
              {canEdit ? <td className="p-3"><Checkbox disabled={editing !== null} aria-label={`Select accounting line ${line.lineNumber}`} checked={selected.includes(line.accountingEntryLineId)} onCheckedChange={(checked) => setSelected((old) => checked ? [...old, line.accountingEntryLineId] : old.filter((id) => id !== line.accountingEntryLineId))} /></td> : null}
              <td className="p-3 font-medium">{line.accountNumber}</td><td className="p-3 text-muted-foreground">{line.lineLabel || line.accountLabel}</td>
              <td className="p-3 text-right tabular-nums">{formatInvoiceMoney(line.debitAmount, currency)}</td><td className="p-3 text-right tabular-nums">{formatInvoiceMoney(line.creditAmount, currency)}</td>
              <td className="p-3 text-xs">{line.vatRate == null ? '—' : `${line.vatRate}%`} · {line.classificationName ?? '—'}</td>
              {canEdit ? <td className="p-3"><Button aria-label={`Edit accounting line ${line.lineNumber}`} disabled={editing !== null} onClick={() => setEditing(line.accountingEntryLineId)} size="sm" variant="ghost"><Pencil aria-hidden="true" />Edit</Button></td> : null}
            </tr>)}
        </tbody>
      </table>
      {!entry.lines.length && editing === null ? <p className="p-6 text-center text-sm text-muted-foreground">No entry lines are available.</p> : null}
    </div>
    {editing !== null ? <AccountingEntryLineEditor key={editing} entryId={entry.accountingEntryId} version={entry.version}
      line={entry.lines.find((line) => line.accountingEntryLineId === editing)} onCancel={() => setEditing(null)}
      onCloseGuardChange={onCloseGuardChange} onEntryUpdated={saved} onReload={async () => { await onReload(); setEditing(null) }} /> : null}
    <Dialog open={confirm} onOpenChange={(open) => { if (!pending) setConfirm(open) }}>
      <DialogContent><DialogHeader><DialogTitle>Remove selected lines?</DialogTitle><DialogDescription>Each selected line is removed separately. If one removal fails, reload to review the lines already removed.</DialogDescription></DialogHeader>
        <ul className="max-h-48 overflow-auto text-sm">{targeted.map((line) => <li key={line.accountingEntryLineId}>Line {line.lineNumber}: {line.accountNumber} — {line.lineLabel}</li>)}</ul>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter><Button disabled={pending} variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
          {error ? <Button onClick={async () => { await onReload(); setSelected([]); setConfirm(false) }}>Reload entry</Button> : <Button disabled={pending || entry.version === undefined} onClick={() => void remove()} variant="destructive">{pending ? 'Removing…' : 'Confirm removal'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
