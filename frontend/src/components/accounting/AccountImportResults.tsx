import { useState } from 'react'
import { Download } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AccountImportRows } from '@/components/accounting/AccountImportRows'
import { downloadImportReport } from '@/components/accounting/account-import-report'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AccountImportResult } from '@/types/account-import'

export type AccountImportFailure = { message: string, blocked: boolean, noChanges: boolean, code?: string }
export type AccountImportOutcome = { kind: 'complete', result: AccountImportResult } | { kind: 'failed', failure: AccountImportFailure }

export function AccountImportPending() {
  return <div aria-busy="true" className="min-h-75 space-y-5 rounded-lg border bg-card px-6 py-8">
    <div><div role="status"><h3 className="text-lg font-semibold leading-7">Importing accounts…</h3></div><p className="mt-2 text-sm text-muted-foreground">Keep this window open while Docomptia validates and creates your accounts.</p></div>
    <Progress aria-label="Waiting for import confirmation" aria-valuetext="Waiting for the server" className="h-2 [&>div]:w-1/3 [&>div]:transform-none! [&>div]:motion-safe:animate-pulse" value={null} />
    <div className="min-h-21 space-y-1.5 rounded-md bg-info-muted p-4 text-xs"><p className="font-medium">Creating accounts</p><p>Existing accounts and duplicate rows will be skipped as reviewed. Results will appear when the server confirms the import.</p></div>
    <p className="text-xs text-muted-foreground">Leaving this page does not cancel an import already received by the server.</p>
  </div>
}

export function AccountImportFailed({ failure, onRetry }: { failure: AccountImportFailure, onRetry: () => void }) {
  return <>
    <div className="min-h-75 space-y-4 rounded-lg border bg-card px-6 py-8">
      <div><h3 className="text-lg font-semibold leading-7">{failure.noChanges ? 'Import failed' : 'Import not confirmed'}</h3><p className="mt-2 text-sm text-muted-foreground">{failure.noChanges ? 'No accounts were added to your chart of accounts by this attempt.' : 'The result is unknown. Some accounts may have been created. Preview again before retrying.'}</p></div>
      <div className="min-h-21 space-y-1.5 rounded-md bg-destructive p-4 text-xs text-destructive-foreground" role="alert"><p className="font-medium">{failure.blocked ? 'Account import unavailable' : 'The import could not be confirmed'}</p><p className="break-words">{failure.message}</p></div>
      {failure.code ? <p className="break-all text-xs text-muted-foreground">Error code: {failure.code}</p> : null}
      {!failure.blocked ? <p className="text-xs text-muted-foreground">Your file and mapping are kept. Retry import opens the mapping step for a fresh preview; it does not submit the import again.</p> : null}
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><Button asChild variant="outline"><Link to="/accounting/accounts">Cancel</Link></Button><Button disabled={failure.blocked} onClick={onRetry}>Retry import</Button></div>
  </>
}

export function AccountImportResults({ fileName, result, onNewImport }: { fileName: string, result: AccountImportResult, onNewImport: () => void }) {
  const [filter, setFilter] = useState('all')
  const [downloadError, setDownloadError] = useState(false)
  const partial = result.invalidRows > 0
  const skipped = result.existingAccounts + result.duplicateAccounts
  const rows = result.rows.filter((row) => filter === 'all' || (filter === 'skipped' ? row.status === 'EXISTING' || row.status === 'DUPLICATE' : row.status === filter))
  const completedAt = new Date(result.importedAt)
  const date = Number.isNaN(completedAt.getTime()) ? result.importedAt : completedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  function download() {
    try { downloadImportReport(fileName, result); setDownloadError(false) }
    catch { setDownloadError(true) }
  }

  return <>
    <div className={`rounded-lg border bg-card px-6 py-8 ${partial ? 'min-h-86 space-y-4' : 'min-h-75 space-y-5'}`}>
      <div><h3 className="text-lg font-semibold leading-7">{result.imported === 0 ? 'No new accounts imported' : partial ? 'Import completed with issues' : 'Chart of accounts imported'}</h3><p className="mt-2 text-sm text-muted-foreground">{partial ? 'Some rows were rejected. Review the report to correct them before importing again.' : 'Review your accounts and their active status in the chart of accounts.'}</p></div>
      <div className={`min-h-21 space-y-1.5 rounded-md p-4 text-xs ${partial ? 'bg-warning-muted' : result.imported > 0 ? 'bg-success-muted' : 'bg-muted'}`} role="status">
        <p className="font-medium">{partial ? `${result.imported} imported · ${skipped} skipped · ${result.invalidRows} rejected` : result.imported > 0 ? `${result.imported} accounts imported successfully` : 'No new accounts were created'}</p>
        <p>{result.existingAccounts} existing accounts and {result.duplicateAccounts} duplicate rows skipped. {partial ? 'Rejected rows are listed below with their errors.' : 'No rejected rows.'}</p>
      </div>
      {partial ? <dl className="grid gap-3 sm:grid-cols-3">{[{ label: 'Imported', count: result.imported, variant: 'default' }, { label: 'Skipped', count: skipped, variant: 'secondary' }, { label: 'Rejected', count: result.invalidRows, variant: 'destructive' }].map(({ label, count, variant }) => <div className="flex min-h-16 items-center justify-between gap-2 rounded-lg border p-3" key={label}><dt className="text-sm font-medium">{label}</dt><dd><Badge variant={variant as 'default' | 'secondary' | 'destructive'}>{count}</Badge></dd></div>)}</dl> : null}
      <div className="flex min-h-12 flex-col justify-between gap-2 text-xs sm:flex-row sm:items-center"><p className="break-all text-sm font-medium">{fileName}</p><p className="shrink-0 text-muted-foreground">Completed <time dateTime={result.importedAt}>{date}</time></p></div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><Button onClick={download} variant="outline"><Download aria-hidden="true" />Download report</Button><Button asChild><Link to="/accounting/accounts">View accounts</Link></Button></div>
    {downloadError ? <p className="text-sm text-destructive" role="alert">The report could not be downloaded. Please try again.</p> : null}
    <div className="min-w-0 space-y-4 rounded-lg border bg-card p-6">
      <div><h3 className="text-base font-semibold">Import report</h3><p className="mt-2 text-sm text-muted-foreground">Download the full report before leaving or starting another import. It is available only during this visit.</p></div>
      <Select onValueChange={setFilter} value={filter}><SelectTrigger aria-label="Filter import results" className="w-full sm:w-60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All rows ({result.rows.length})</SelectItem><SelectItem value="IMPORTED">Imported ({result.imported})</SelectItem><SelectItem value="skipped">Skipped ({skipped})</SelectItem><SelectItem value="INVALID">Rejected ({result.invalidRows})</SelectItem></SelectContent></Select>
      <AccountImportRows key={filter} report rows={rows} />
      <Button className="w-full sm:w-auto" onClick={onNewImport} variant="outline">{partial ? 'Import corrected CSV' : 'Import another CSV'}</Button>
    </div>
  </>
}
