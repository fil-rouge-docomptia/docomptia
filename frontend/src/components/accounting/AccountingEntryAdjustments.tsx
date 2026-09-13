import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createAccountingAdjustment, getRelatedAccountingEntries } from '@/services/accounting'
import { ApiError } from '@/services/api'
import { entryExportLabel, entryTypeLabels } from './accounting-utils'
import type { AccountingEntryRecord } from '@/types/accounting'

export function AccountingEntryAdjustments({ record, onOpenEntry, onReload }: {
  record: AccountingEntryRecord; onOpenEntry: (id: number) => void; onReload: () => Promise<void>
}) {
  const [params] = useSearchParams()
  const [kind, setKind] = useState<'reversal' | 'corrective-entry' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [related, setRelated] = useState<AccountingEntryRecord[] | null>(null)
  const [relatedError, setRelatedError] = useState(false)
  const [reading, setReading] = useState(false)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const mutation = useRef<AbortController | null>(null)
  const read = useRef<AbortController | null>(null)
  useEffect(() => () => { mutation.current?.abort(); read.current?.abort() }, [])
  const entry = record.entry
  const eligible = entry.status === 'GENERATED' && !entry.reversedAccountingEntryId && record.invoiceStatus === 'EXPORTEE'
  const existingReversal = related?.find((item) => item.entry.status === 'REVERSAL' && item.entry.reversedAccountingEntryId === entry.accountingEntryId)
  const href = (id: number) => { const next = new URLSearchParams(params); next.set('entry', String(id)); return `/accounting?${next}` }
  async function loadRelated(reconcile = false) {
    if (read.current) return
    const controller = new AbortController()
    read.current = controller
    setReading(true)
    setRelatedError(false)
    try {
      if (reconcile) await onReload()
      const entries = await getRelatedAccountingEntries(record.invoiceId, record.invoiceNumber, controller.signal)
      if (!controller.signal.aborted) { setRelated(entries); if (reconcile) { setError(null); setKind(null) } }
    } catch (cause) {
      if (!controller.signal.aborted) { setRelatedError(true); if (reconcile) setError(cause) }
    } finally {
      if (!controller.signal.aborted) { read.current = null; setReading(false) }
    }
  }
  async function create() {
    if (!kind || mutation.current || error) return
    const controller = new AbortController()
    mutation.current = controller
    setPending(true)
    try {
      const result = await createAccountingAdjustment(entry.accountingEntryId, kind, controller.signal)
      if (!controller.signal.aborted) onOpenEntry(result.accountingEntryId)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause)
    } finally {
      if (!controller.signal.aborted) { mutation.current = null; setPending(false) }
    }
  }
  return <section aria-label="Entry adjustments" className="space-y-3">
    {entry.status === 'CORRECTIVE' ? <p className="rounded-lg border border-border bg-info-muted p-3 text-sm">Review and edit the copied lines below to record your correction. This entry has its own export status.</p> : null}
    {entry.reversedAccountingEntryId ? <Button asChild variant="link" className="h-auto px-0"><Link to={href(entry.reversedAccountingEntryId)}>Open linked {entry.status === 'CORRECTIVE' ? 'reversal' : 'original'} #{entry.reversedAccountingEntryId}</Link></Button> : null}
    {eligible ? <div className="space-y-2"><p className="text-sm text-muted-foreground">The exported original is read-only. Create a linked reversal or a corrective entry to adjust it.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={Boolean(existingReversal)} onClick={(event) => { trigger.current = event.currentTarget; setKind('reversal') }}>Create reversal</Button><Button variant="outline" onClick={(event) => { trigger.current = event.currentTarget; setKind('corrective-entry') }}>Create corrective entry</Button></div>
    </div> : null}
    <Button variant="ghost" disabled={reading} onClick={() => void loadRelated()}>{reading ? 'Loading related entries…' : related ? 'Refresh related entries' : 'Show related entries'}</Button>
    {relatedError ? <p role="alert" className="text-sm text-destructive">Unable to reload related entries. Try again before creating another adjustment.</p> : null}
    {related ? <ul aria-label="Related entries" className="space-y-2 text-sm">{related.filter((item) => item.entry.accountingEntryId !== entry.accountingEntryId).map((item) => <li key={item.entry.accountingEntryId}>
      <Link className="font-medium text-primary underline underline-offset-4" to={href(item.entry.accountingEntryId)}>{item.entry.entryNumber}</Link> · {entryTypeLabels[item.entry.status]} · {entryExportLabel(item)}
    </li>)}{related.length <= 1 ? <li className="text-muted-foreground">No other entries were found for this invoice.</li> : null}</ul> : null}
    <Dialog open={kind !== null} onOpenChange={(open) => { if (!open && !pending && !reading) setKind(null) }}>
      <DialogContent onCloseAutoFocus={(event) => { if (trigger.current?.isConnected) { event.preventDefault(); trigger.current.focus() } }}><DialogHeader><DialogTitle>{kind === 'reversal' ? 'Create a reversal?' : 'Create a corrective entry?'}</DialogTitle><DialogDescription>
        {kind === 'reversal' ? 'Create a separate entry with the debit and credit amounts reversed. The exported original remains unchanged.' : 'Create or open the linked corrective entry. A reversal is created automatically if needed. Review and edit the copied lines before exporting the correction.'}
      </DialogDescription></DialogHeader>
        <p className="text-sm">Original: {entry.entryNumber} · {record.invoiceNumber}</p>
        {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error instanceof ApiError ? error.message : 'The result could not be confirmed. The request may have been saved.'}</p><p>Reload the entry and its related entries before another attempt.</p></div> : null}
        <DialogFooter><Button variant="outline" disabled={pending || reading} onClick={() => setKind(null)}>Cancel</Button>
          {error ? <Button disabled={reading} onClick={() => void loadRelated(true)}>{reading ? 'Reloading…' : 'Reload entry and related entries'}</Button> : <Button disabled={pending} onClick={() => void create()}>{pending ? 'Creating…' : 'Confirm creation'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
