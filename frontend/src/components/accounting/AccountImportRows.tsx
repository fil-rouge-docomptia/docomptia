import { useState } from 'react'

import { importRowLabels } from '@/components/accounting/account-import-report'
import { SupplierPagination } from '@/components/supplier/SupplierPagination'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AccountImportRow } from '@/types/account-import'

const previewLabels = { ...importRowLabels, EXISTING: 'Existing', DUPLICATE: 'Duplicate', INVALID: 'Invalid' }

export function AccountImportRows({ rows, report = false }: { rows: AccountImportRow[], report?: boolean }) {
  const [page, setPage] = useState(1)
  return <>
    <div aria-label={report ? 'Import report rows' : 'Mapped account rows'} className="overflow-x-auto rounded-md border [&>div]:overflow-visible" role="region" tabIndex={0}>
      <Table className="min-w-160 table-fixed">
        <TableHeader><TableRow><TableHead className="w-14">Line</TableHead><TableHead>Number</TableHead><TableHead>Label</TableHead><TableHead>Type</TableHead><TableHead className="w-20">Active</TableHead><TableHead className="w-36">Status / errors</TableHead></TableRow></TableHeader>
        <TableBody>{rows.slice((page - 1) * 10, page * 10).map((row) => <TableRow key={row.lineNumber}>
          <TableCell>{row.lineNumber}</TableCell><TableCell className="break-all">{row.accountNumber}</TableCell><TableCell className="break-all">{row.accountLabel}</TableCell><TableCell className="break-all">{row.accountType}</TableCell><TableCell>{row.active ? 'Yes' : 'No'}</TableCell>
          <TableCell className="break-words"><Badge className="h-auto whitespace-normal" variant={row.status === 'INVALID' ? 'destructive' : row.status === 'IMPORTED' ? 'default' : 'secondary'}>{(report ? importRowLabels : previewLabels)[row.status]}</Badge>{row.errors.length > 0 ? <ul className="mt-2 space-y-1 text-xs text-destructive">{row.errors.map((error, index) => <li key={index}>{error}</li>)}</ul> : null}</TableCell>
        </TableRow>)}{rows.length === 0 ? <TableRow><TableCell className="h-20 text-center text-muted-foreground" colSpan={6}>No rows in this category.</TableCell></TableRow> : null}</TableBody>
      </Table>
    </div>
    <div className="[&_nav]:px-0 [&_nav>div]:gap-1"><SupplierPagination ariaLabel="Import row pagination" currentPage={page} itemLabel="rows" onPageChange={setPage} pageSize={10} totalElements={rows.length} totalPages={Math.max(1, Math.ceil(rows.length / 10))} /></div>
  </>
}
