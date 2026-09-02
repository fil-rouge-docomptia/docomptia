import { type FormEvent, useState } from 'react'
import { Columns3, Search, X } from 'lucide-react'

import { InvoiceAdvancedFiltersPopover } from '@/components/invoice/InvoiceAdvancedFiltersPopover'
import { invoiceStatusLabels } from '@/components/invoice/invoice-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  InvoiceFilterUpdates,
  InvoiceListFilters,
} from '@/types/invoice'

const invoiceStatusOptions = Object.entries(invoiceStatusLabels)

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatFilterDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

type QuickFilterPopoverProps = {
  description: string
  inputLabel: string
  inputType?: 'date' | 'text'
  label: string
  onApply: (value: string | undefined) => void
  placeholder?: string
  value?: string
}

function QuickFilterPopover({
  description,
  inputLabel,
  inputType = 'text',
  label,
  onApply,
  placeholder,
  value,
}: QuickFilterPopoverProps) {
  const [draftValue, setDraftValue] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const inputId = `invoice-${label.toLowerCase().replaceAll(' ', '-')}-filter`

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftValue(value ?? '')
    }
    setOpen(nextOpen)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onApply(draftValue.trim() || undefined)
    setOpen(false)
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">{label}</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-4">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-sm font-semibold text-popover-foreground">{label}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={inputId}>{inputLabel}</Label>
            <Input
              autoFocus
              className="h-9 text-xs"
              id={inputId}
              onChange={(event) => setDraftValue(event.target.value)}
              placeholder={placeholder}
              type={inputType}
              value={draftValue}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setDraftValue('')}
              size="sm"
              type="button"
              variant="outline"
            >
              Clear
            </Button>
            <Button size="sm" type="submit">Apply</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

type ActiveFilter = {
  clear: InvoiceFilterUpdates
  label: string
}

function getActiveFilters(filters: InvoiceListFilters): ActiveFilter[] {
  const activeFilters: ActiveFilter[] = []

  if (filters.invoiceNumber) {
    activeFilters.push({
      clear: { invoiceNumber: undefined },
      label: `Invoice: ${filters.invoiceNumber}`,
    })
  }

  if (filters.status?.length) {
    activeFilters.push({
      clear: { status: undefined },
      label: `Status: ${filters.status.map((status) => invoiceStatusLabels[status] ?? status).join(', ')}`,
    })
  }

  if (filters.supplier) {
    activeFilters.push({
      clear: { supplier: undefined },
      label: `Supplier: ${filters.supplier}`,
    })
  }

  if (filters.client) {
    activeFilters.push({
      clear: { client: undefined },
      label: `Client: ${filters.client}`,
    })
  }

  if (filters.invoiceDate) {
    activeFilters.push({
      clear: { invoiceDate: undefined },
      label: `Invoice date: ${formatFilterDate(filters.invoiceDate)}`,
    })
  }

  if (filters.startDate || filters.endDate) {
    const start = filters.startDate ? formatFilterDate(filters.startDate) : 'Any date'
    const end = filters.endDate ? formatFilterDate(filters.endDate) : 'Today'
    activeFilters.push({
      clear: { endDate: undefined, startDate: undefined },
      label: `Invoice period: ${start} – ${end}`,
    })
  }

  if (filters.dueDate) {
    activeFilters.push({
      clear: { dueDate: undefined },
      label: `Due date: ${formatFilterDate(filters.dueDate)}`,
    })
  }

  if (filters.minAmount || filters.maxAmount) {
    const amountLabel = filters.minAmount && filters.maxAmount
      ? `€${filters.minAmount} – €${filters.maxAmount}`
      : filters.minAmount
        ? `At least €${filters.minAmount}`
        : `Up to €${filters.maxAmount}`
    activeFilters.push({
      clear: { maxAmount: undefined, minAmount: undefined },
      label: `Amount: ${amountLabel}`,
    })
  }

  return activeFilters
}

type InvoiceFiltersProps = {
  filters: InvoiceListFilters
  onChange: (updates: InvoiceFilterUpdates) => void
  onReset: () => void
}

export function InvoiceFilters({ filters, onChange, onReset }: InvoiceFiltersProps) {
  const activeFilters = getActiveFilters(filters)
  const statusValue = filters.status?.length === 1
    ? filters.status[0]
    : filters.status?.length
      ? 'multiple'
      : 'all'

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const invoiceNumber = String(formData.get('invoiceNumber') ?? '').trim()
    onChange({ invoiceNumber: invoiceNumber || undefined })
  }

  return (
    <section aria-label="Invoice filters" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form className="relative min-w-56 flex-1 sm:max-w-xs" onSubmit={handleSearch}>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search invoices"
            className="h-10 pl-9"
            defaultValue={filters.invoiceNumber ?? ''}
            key={filters.invoiceNumber ?? ''}
            name="invoiceNumber"
            placeholder="Search invoices…"
            type="search"
          />
        </form>

        <Select
          onValueChange={(status) => onChange({ status: status === 'all' ? undefined : [status] })}
          value={statusValue}
        >
          <SelectTrigger aria-label="Filter by status" className="h-10 w-auto min-w-28">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusValue === 'multiple' ? (
              <SelectItem disabled value="multiple">Multiple statuses</SelectItem>
            ) : null}
            {invoiceStatusOptions.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <QuickFilterPopover
          description="Search by supplier name or legal identifier."
          inputLabel="Supplier"
          label="Supplier"
          onApply={(supplier) => onChange({ supplier })}
          placeholder="Name, SIREN, SIRET or VAT number"
          value={filters.supplier}
        />
        <QuickFilterPopover
          description="Filter invoices issued on an exact date."
          inputLabel="Invoice date"
          inputType="date"
          label="Invoice date"
          onApply={(invoiceDate) => onChange({ invoiceDate })}
          value={filters.invoiceDate}
        />

        <Button
          disabled
          title="Project / Site filtering is not supported by the invoice API yet"
          type="button"
          variant="outline"
        >
          Project / Site
        </Button>
        <Button
          disabled
          title="Assignee filtering is not supported by the invoice API yet"
          type="button"
          variant="outline"
        >
          Assignee
        </Button>

        <InvoiceAdvancedFiltersPopover
          filters={filters}
          onApply={onChange}
          onReset={onReset}
        />

        <Button
          className="bg-accent text-accent-foreground"
          disabled
          title="Column customization is not available yet"
          type="button"
          variant="ghost"
        >
          <Columns3 aria-hidden="true" />
          Columns
        </Button>
      </div>

      {activeFilters.length ? (
        <div aria-label="Active invoice filters" className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Button
              aria-label={`Remove ${filter.label}`}
              className="h-8 rounded-full px-3 text-xs"
              key={filter.label}
              onClick={() => onChange(filter.clear)}
              type="button"
              variant="outline"
            >
              {filter.label}
              <X aria-hidden="true" className="size-3" />
            </Button>
          ))}
          <Button className="h-8 px-2 text-xs" onClick={onReset} type="button" variant="ghost">
            Clear all
          </Button>
        </div>
      ) : null}
    </section>
  )
}
