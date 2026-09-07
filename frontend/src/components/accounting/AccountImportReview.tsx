import { useState } from 'react'

import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AccountImportPreview, AccountImportRow } from '@/types/account-import'

const statusLabels: Record<AccountImportRow['status'], string> = { NEW: 'New', EXISTING: 'Existing', DUPLICATE: 'Duplicate', INVALID: 'Invalid', IMPORTED: 'Imported' }

export function AccountImportReview({ preview, excludeInvalid, onExcludeInvalid }: {
  preview: AccountImportPreview
  excludeInvalid: boolean
  onExcludeInvalid: (exclude: boolean) => void
}) {
  const [page, setPage] = useState(1)
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
      <div aria-label="Mapped account rows" className="overflow-x-auto rounded-md border [&>div]:overflow-visible" role="region" tabIndex={0}>
        <Table className="min-w-160 table-fixed">
          <TableHeader><TableRow><TableHead className="w-14">Line</TableHead><TableHead>Number</TableHead><TableHead>Label</TableHead><TableHead>Type</TableHead><TableHead className="w-20">Active</TableHead><TableHead className="w-36">Status / errors</TableHead></TableRow></TableHeader>
          <TableBody>{preview.rows.slice((page - 1) * 10, page * 10).map((row) => <TableRow key={row.lineNumber}>
            <TableCell>{row.lineNumber}</TableCell><TableCell className="break-all">{row.accountNumber}</TableCell><TableCell className="break-all">{row.accountLabel}</TableCell><TableCell className="break-all">{row.accountType}</TableCell><TableCell>{row.active ? 'Yes' : 'No'}</TableCell>
            <TableCell className="break-words"><Badge variant={row.status === 'INVALID' ? 'destructive' : 'secondary'}>{statusLabels[row.status]}</Badge>{row.errors.length > 0 ? <ul className="mt-2 space-y-1 text-xs text-destructive">{row.errors.map((error, index) => <li key={index}>{error}</li>)}</ul> : null}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      <div className="[&_nav]:px-0 [&_nav>div]:gap-1"><SupplierPagination ariaLabel="Import row pagination" currentPage={page} itemLabel="rows" onPageChange={setPage} pageSize={10} totalElements={preview.rows.length} totalPages={Math.max(1, Math.ceil(preview.rows.length / 10))} /></div>
    </div>
  )
}
