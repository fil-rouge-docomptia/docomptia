import { AccountImportRows } from '@/components/accounting/AccountImportRows'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { AccountImportPreview } from '@/types/account-import'

export function AccountImportReview({ preview, excludeInvalid, onExcludeInvalid }: {
  preview: AccountImportPreview
  excludeInvalid: boolean
  onExcludeInvalid: (exclude: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Review detected accounts</h3><p className="mt-2 text-sm text-muted-foreground">Check the mapped values and resolve or exclude invalid rows before continuing.</p></div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'New accounts', value: preview.newAccounts },
          { label: 'Existing accounts', value: preview.existingAccounts },
          { label: 'Duplicate accounts', value: preview.duplicateAccounts },
          { label: 'Invalid rows', value: preview.invalidRows },
        ].map(({ label, value }) => <div className="flex min-h-21 flex-col-reverse items-start justify-center gap-2 rounded-lg border p-3" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd><Badge variant="secondary">{value}</Badge></dd></div>)}
      </dl>
      {preview.existingAccounts + preview.duplicateAccounts > 0 ? <div className="space-y-1 rounded-lg bg-warning-muted p-4 text-xs text-warning-foreground"><p className="font-semibold">Rows with warnings</p><p>{preview.existingAccounts} existing accounts and {preview.duplicateAccounts} duplicate rows will be skipped. Existing accounts will not be overwritten.</p></div> : null}
      {preview.invalidRows > 0 ? <>
        <div className="space-y-1 rounded-lg bg-destructive p-4 text-xs text-destructive-foreground" role="alert"><p className="font-semibold">{preview.invalidRows} invalid rows</p><p>Check the row errors below. Correct the CSV and upload it again, adjust the mapping, or explicitly exclude these rows.</p></div>
        <div className="flex items-start gap-2"><Checkbox checked={excludeInvalid} id="exclude-invalid" onCheckedChange={(checked) => onExcludeInvalid(checked === true)} /><Label className="leading-5" htmlFor="exclude-invalid">Exclude {preview.invalidRows} invalid rows from this import</Label></div>
      </> : null}
      {preview.newAccounts === 0 ? <p className="rounded-lg bg-muted p-4 text-sm" role="status">No new accounts to import. Adjust the mapping or choose another CSV file.</p> : null}
      <AccountImportRows rows={preview.rows} />
    </div>
  )
}
