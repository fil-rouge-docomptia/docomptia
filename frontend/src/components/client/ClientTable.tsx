import { useState } from 'react'
import { ChevronDown, Ellipsis, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ClientStatusBadge } from '@/components/client/ClientStatusBadge'
import { formatClientDate } from '@/components/client/client-utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Customer } from '@/types/customer'

const columns = ['SIRET', 'VAT number', 'Projects', 'Invoice count', 'Revenue', 'Last updated', 'Status'] as const
type ClientColumn = typeof columns[number]

export function ClientTable({ customers, currentPage }: { customers: Customer[]; currentPage: number }) {
  const [hiddenColumns, setHiddenColumns] = useState<ClientColumn[]>([])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-80">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-describedby="client-search-unavailable"
            aria-label="Search clients"
            className="h-11 pl-9 sm:h-9"
            disabled
            placeholder="Search clients, SIRET, VAT…"
            type="search"
          />
        </div>
        <div className="flex gap-2">
          <Button aria-describedby="client-search-unavailable" className="h-11 sm:h-10" disabled variant="outline">
            <ChevronDown aria-hidden="true" />Status
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button className="h-11 bg-accent text-accent-foreground sm:h-10" variant="ghost">
                <Ellipsis aria-hidden="true" />Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" aria-label="Client columns" className="w-56 p-3">
              <p className="mb-2 text-sm font-medium">Visible columns</p>
              {columns.map((column) => (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm" key={column}>
                  <Checkbox
                    checked={!hiddenColumns.includes(column)}
                    onCheckedChange={(checked) => setHiddenColumns((hidden) => checked === true
                      ? hidden.filter((item) => item !== column)
                      : [...hidden, column])}
                  />
                  {column}
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" id="client-search-unavailable">
        Search and status filters are not available yet. Clients are listed alphabetically.
      </p>
      <Table aria-describedby="client-metrics-unavailable" aria-label="Clients" className="min-w-[1000px]">
        <TableHeader className="bg-muted">
          <TableRow className="h-10 hover:bg-transparent">
            <TableHead className="h-10 px-3 text-xs">Client / Legal name</TableHead>
            {columns.filter((column) => !hiddenColumns.includes(column)).map((column) => (
              <TableHead className="h-10 px-3 text-xs" key={column}>{column}</TableHead>
            ))}
            <TableHead className="h-10 px-3 text-right text-xs">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => {
            const values = {
              SIRET: customer.siret || '—',
              'VAT number': customer.vatNumber || '—',
              Projects: <span aria-label="Not available">—</span>,
              'Invoice count': <span aria-label="Not available">—</span>,
              Revenue: <span aria-label="Not available">—</span>,
              'Last updated': formatClientDate(customer.updatedAt),
              Status: <ClientStatusBadge active={customer.active} />,
            }
            return (
              <TableRow className="h-11" key={customer.customerId}>
                <TableCell className="max-w-60 px-3 py-2 text-xs">
                  <span className="block truncate font-medium text-foreground" title={customer.legalName}>{customer.legalName}</span>
                  {customer.name !== customer.legalName ? (
                    <span className="mt-0.5 block truncate text-muted-foreground" title={customer.name}>{customer.name}</span>
                  ) : null}
                </TableCell>
                {columns.filter((column) => !hiddenColumns.includes(column)).map((column) => (
                  <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground" key={column}>
                    {values[column]}
                  </TableCell>
                ))}
                <TableCell className="px-3 py-1 text-right">
                  <Button asChild className="h-11 text-primary sm:h-9" size="sm" variant="ghost">
                    <Link aria-label={`Open client ${customer.legalName}`} to={`/clients/${customer.customerId}?page=${currentPage}`}>
                      Open
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground" id="client-metrics-unavailable">
        Project counts, invoice counts and revenue are not provided by the client service.
      </p>
    </div>
  )
}
