import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { accountColumns, type AccountSortColumn } from '@/components/accounting/chart-of-accounts-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ChartOfAccount } from '@/types/onboarding'

type ChartOfAccountsTableProps = {
  accounts: ChartOfAccount[]
  sort: AccountSortColumn
  descending: boolean
  onSort: (column: AccountSortColumn) => void
}

export function ChartOfAccountsTable({ accounts, sort, descending, onSort }: ChartOfAccountsTableProps) {
  return (
    <div aria-label="Chart of accounts table" className="overflow-x-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>div]:overflow-visible" role="region" tabIndex={0}>
      <Table aria-label="Organization accounts" className="min-w-[680px] table-fixed text-xs">
        <TableHeader className="bg-muted">
          <TableRow>
            {accountColumns.map(({ key, label }) => {
              const Icon = sort === key ? descending ? ArrowDown : ArrowUp : ArrowUpDown
              return (
                <TableHead aria-sort={sort === key ? descending ? 'descending' : 'ascending' : 'none'} className={key === 'accountLabel' ? 'h-10 w-[40%] px-2' : 'h-10 w-1/5 px-2'} key={key} scope="col">
                  <Button aria-label={`Sort by ${label.toLowerCase()}`} className="h-11 max-w-full gap-2 px-2 text-xs sm:h-10" onClick={() => onSort(key)} variant="ghost">
                    {label}<Icon aria-hidden="true" className="size-3.5" />
                  </Button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow className={account.active ? undefined : 'bg-muted/30 text-muted-foreground'} key={account.accountId}>
              <TableCell className="h-11 break-words px-4 py-2 tabular-nums sm:h-10">{account.accountNumber}</TableCell>
              <TableCell className="break-words px-4 py-2">{account.accountLabel}</TableCell>
              <TableCell className="break-words px-4 py-2 text-muted-foreground">{account.accountType}</TableCell>
              <TableCell className="px-4 py-2">
                <Badge className={account.active ? 'bg-success-muted text-success' : 'bg-muted text-muted-foreground'} variant="secondary">
                  {account.active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
