import { type FormEvent, useState } from 'react'
import { Ellipsis, Search, X } from 'lucide-react'

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
import type { InvoiceFilterUpdates, InvoiceListFilters } from '@/types/invoice'

export type DocumentView = 'grid' | 'table'

type TextFilterPopoverProps = {
  description: string
  filters: InvoiceListFilters
  id: string
  inputLabel: string
  inputType?: 'date' | 'text'
  label: string
  onChange: (updates: InvoiceFilterUpdates) => void
  param: 'invoiceDate' | 'invoiceNumber' | 'supplier'
  placeholder?: string
}

function TextFilterPopover({
  description,
  filters,
  id,
  inputLabel,
  inputType = 'text',
  label,
  onChange,
  param,
  placeholder,
}: TextFilterPopoverProps) {
  const value = filters[param]
  const [draftValue, setDraftValue] = useState(value ?? '')
  const [open, setOpen] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftValue(value ?? '')
    }
    setOpen(nextOpen)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onChange({ [param]: draftValue.trim() || undefined })
    setOpen(false)
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button aria-pressed={Boolean(value)} type="button" variant="outline">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-4">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-sm font-semibold text-popover-foreground">{label}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={id}>{inputLabel}</Label>
            <Input
              autoFocus
              className="h-9 text-xs"
              id={id}
              onChange={(event) => setDraftValue(event.target.value)}
              placeholder={placeholder}
              type={inputType}
              value={draftValue}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                onChange({ [param]: undefined })
                setOpen(false)
              }}
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

type AmountFilterPopoverProps = {
  filters: InvoiceListFilters
  onChange: (updates: InvoiceFilterUpdates) => void
}

function AmountFilterPopover({ filters, onChange }: AmountFilterPopoverProps) {
  const [minAmount, setMinAmount] = useState(filters.minAmount ?? '')
  const [maxAmount, setMaxAmount] = useState(filters.maxAmount ?? '')
  const [open, setOpen] = useState(false)
  const active = Boolean(filters.minAmount || filters.maxAmount)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setMinAmount(filters.minAmount ?? '')
      setMaxAmount(filters.maxAmount ?? '')
    }
    setOpen(nextOpen)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onChange({
      maxAmount: maxAmount || undefined,
      minAmount: minAmount || undefined,
    })
    setOpen(false)
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button aria-pressed={active} type="button" variant="outline">Amount</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-4">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-sm font-semibold text-popover-foreground">Amount</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Filter by the invoice total including tax.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="document-min-amount">Minimum</Label>
              <Input
                id="document-min-amount"
                min="0"
                onChange={(event) => setMinAmount(event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={minAmount}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="document-max-amount">Maximum</Label>
              <Input
                id="document-max-amount"
                min="0"
                onChange={(event) => setMaxAmount(event.target.value)}
                placeholder="5000.00"
                step="0.01"
                type="number"
                value={maxAmount}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                onChange({ maxAmount: undefined, minAmount: undefined })
                setOpen(false)
              }}
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

type MoreDocumentFiltersProps = {
  filters: InvoiceListFilters
  onChange: (updates: InvoiceFilterUpdates) => void
}

function MoreDocumentFilters({ filters, onChange }: MoreDocumentFiltersProps) {
  const [client, setClient] = useState(filters.client ?? '')
  const [dueDate, setDueDate] = useState(filters.dueDate ?? '')
  const [startDate, setStartDate] = useState(filters.startDate ?? '')
  const [endDate, setEndDate] = useState(filters.endDate ?? '')
  const [open, setOpen] = useState(false)
  const active = Boolean(filters.client || filters.dueDate || filters.startDate || filters.endDate)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setClient(filters.client ?? '')
      setDueDate(filters.dueDate ?? '')
      setStartDate(filters.startDate ?? '')
      setEndDate(filters.endDate ?? '')
    }
    setOpen(nextOpen)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onChange({
      client: client.trim() || undefined,
      dueDate: dueDate || undefined,
      endDate: endDate || undefined,
      startDate: startDate || undefined,
    })
    setOpen(false)
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-pressed={active}
          className="bg-accent text-accent-foreground"
          type="button"
          variant="ghost"
        >
          <Ellipsis aria-hidden="true" />
          More filters
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[400px] max-w-[calc(100vw-2rem)] rounded-lg p-5 shadow-elevation-4"
      >
        <form onSubmit={handleSubmit}>
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">More filters</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Refine documents using criteria supported by the invoice API.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs" htmlFor="document-client-filter">Client</Label>
              <Input
                id="document-client-filter"
                onChange={(event) => setClient(event.target.value)}
                placeholder="Name or legal identifier"
                value={client}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs" htmlFor="document-due-date-filter">Due date</Label>
              <Input
                id="document-due-date-filter"
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                value={dueDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="document-start-date-filter">
                Invoice period from
              </Label>
              <Input
                id="document-start-date-filter"
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="document-end-date-filter">
                Invoice period to
              </Label>
              <Input
                id="document-end-date-filter"
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              onClick={() => {
                onChange({
                  client: undefined,
                  dueDate: undefined,
                  endDate: undefined,
                  startDate: undefined,
                })
                setOpen(false)
              }}
              type="button"
              variant="outline"
            >
              Clear
            </Button>
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function UnsupportedFilter({ label }: { label: string }) {
  return (
    <Button
      disabled
      title={`${label} filtering is not supported by the invoice API yet`}
      type="button"
      variant="outline"
    >
      {label}
    </Button>
  )
}

type DocumentFiltersProps = {
  filters: InvoiceListFilters
  onChange: (updates: InvoiceFilterUpdates) => void
  onViewChange: (view: DocumentView) => void
  view: DocumentView
}

export function DocumentFilters({
  filters,
  onChange,
  onViewChange,
  view,
}: DocumentFiltersProps) {
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
    <section aria-label="Document filters" className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <form className="relative w-full sm:w-80" onSubmit={handleSearch}>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search documents by invoice number"
            className="h-9 pl-9 pr-10"
            defaultValue={filters.invoiceNumber ?? ''}
            key={filters.invoiceNumber ?? ''}
            name="invoiceNumber"
            placeholder="Search invoices, suppliers, references…"
            type="search"
          />
          {filters.invoiceNumber ? (
            <Button
              aria-label="Clear document search"
              className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
              onClick={() => onChange({ invoiceNumber: undefined })}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <TextFilterPopover
            description="Search by supplier name or legal identifier."
            filters={filters}
            id="document-supplier-filter"
            inputLabel="Supplier"
            label="Supplier"
            onChange={onChange}
            param="supplier"
            placeholder="Name, SIREN, SIRET or VAT number"
          />
          <Select
            onValueChange={(status) => onChange({
              status: status === 'all' ? undefined : [status],
            })}
            value={statusValue}
          >
            <SelectTrigger aria-label="Filter documents by status" className="h-10 w-auto min-w-24">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusValue === 'multiple' ? (
                <SelectItem disabled value="multiple">Multiple statuses</SelectItem>
              ) : null}
              {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MoreDocumentFilters filters={filters} onChange={onChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TextFilterPopover
          description="Filter invoices issued on an exact date."
          filters={filters}
          id="document-invoice-date-filter"
          inputLabel="Invoice date"
          inputType="date"
          label="Invoice date"
          onChange={onChange}
          param="invoiceDate"
        />
        <TextFilterPopover
          description="Search by an exact or partial invoice number."
          filters={filters}
          id="document-invoice-number-filter"
          inputLabel="Invoice number"
          label="Invoice number"
          onChange={onChange}
          param="invoiceNumber"
          placeholder="INV-2026"
        />
        <UnsupportedFilter label="Project / Site" />
        <AmountFilterPopover filters={filters} onChange={onChange} />
        <UnsupportedFilter label="Export date" />
        <UnsupportedFilter label="User" />
        <UnsupportedFilter label="Tags" />

        <div aria-label="Document view" className="ml-auto grid grid-cols-2 gap-2" role="group">
          <Button
            aria-pressed={view === 'table'}
            className="h-9 w-28 text-xs"
            onClick={() => onViewChange('table')}
            type="button"
            variant={view === 'table' ? 'outline' : 'secondary'}
          >
            Table
          </Button>
          <Button
            aria-pressed={view === 'grid'}
            className="h-9 w-28 text-xs"
            onClick={() => onViewChange('grid')}
            type="button"
            variant={view === 'grid' ? 'outline' : 'secondary'}
          >
            Preview grid
          </Button>
        </div>
      </div>
    </section>
  )
}
