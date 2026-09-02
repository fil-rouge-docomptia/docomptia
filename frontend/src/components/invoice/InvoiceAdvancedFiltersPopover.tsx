import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'

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

type AmountPreset = 'all' | 'under-500' | '500-1000' | '1000-5000' | 'over-5000' | 'custom'

const amountRanges: Record<Exclude<AmountPreset, 'custom'>, Pick<InvoiceListFilters, 'minAmount' | 'maxAmount'>> = {
  '1000-5000': { maxAmount: '5000', minAmount: '1000' },
  '500-1000': { maxAmount: '1000', minAmount: '500' },
  all: {},
  'over-5000': { minAmount: '5000' },
  'under-500': { maxAmount: '500' },
}

function getAmountPreset(filters: InvoiceListFilters): AmountPreset {
  return (Object.entries(amountRanges).find(([, range]) => (
    range.minAmount === filters.minAmount && range.maxAmount === filters.maxAmount
  ))?.[0] as AmountPreset | undefined) ?? 'custom'
}

type UnsupportedFilterProps = {
  id: string
  label: string
}

function UnsupportedFilter({ id, label }: UnsupportedFilterProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs tracking-[0.1px]" htmlFor={id}>{label}</Label>
      <Button
        className="h-9 w-full justify-start px-3 text-xs font-normal text-muted-foreground"
        disabled
        id={id}
        title={`${label} is not supported by the invoice API yet`}
        type="button"
        variant="outline"
      >
        Not supported
      </Button>
    </div>
  )
}

type InvoiceAdvancedFiltersPopoverProps = {
  filters: InvoiceListFilters
  onApply: (updates: InvoiceFilterUpdates) => void
  onReset: () => void
}

export function InvoiceAdvancedFiltersPopover({
  filters,
  onApply,
  onReset,
}: InvoiceAdvancedFiltersPopoverProps) {
  const [amountPreset, setAmountPreset] = useState<AmountPreset>(() => getAmountPreset(filters))
  const [dueDate, setDueDate] = useState(filters.dueDate ?? '')
  const [open, setOpen] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAmountPreset(getAmountPreset(filters))
      setDueDate(filters.dueDate ?? '')
    }
    setOpen(nextOpen)
  }

  const handleApply = () => {
    const amountRange = amountPreset === 'custom'
      ? { maxAmount: filters.maxAmount, minAmount: filters.minAmount }
      : amountRanges[amountPreset]
    onApply({
      dueDate: dueDate || undefined,
      maxAmount: amountRange.maxAmount,
      minAmount: amountRange.minAmount,
    })
    setOpen(false)
  }

  const handleReset = () => {
    setAmountPreset('all')
    setDueDate('')
    onReset()
    setOpen(false)
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">
          <SlidersHorizontal aria-hidden="true" />
          More filters
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[400px] max-w-[calc(100vw-2rem)] rounded-lg p-5 shadow-elevation-4"
      >
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">Advanced filters</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Refine the current invoice view.</p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs tracking-[0.1px]" htmlFor="invoice-due-date-filter">
              Due date
            </Label>
            <Input
              className="h-9 text-xs"
              id="invoice-due-date-filter"
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs tracking-[0.1px]" htmlFor="invoice-amount-filter">
              Amount
            </Label>
            <Select onValueChange={(value) => setAmountPreset(value as AmountPreset)} value={amountPreset}>
              <SelectTrigger className="h-9 text-xs" id="invoice-amount-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {amountPreset === 'custom' ? (
                  <SelectItem disabled value="custom">Current custom range</SelectItem>
                ) : null}
                <SelectItem value="all">Any amount</SelectItem>
                <SelectItem value="under-500">Up to €500</SelectItem>
                <SelectItem value="500-1000">€500 to €1,000</SelectItem>
                <SelectItem value="1000-5000">€1,000 to €5,000</SelectItem>
                <SelectItem value="over-5000">€5,000 and above</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <UnsupportedFilter id="invoice-ocr-confidence-filter" label="OCR confidence" />
          <UnsupportedFilter id="invoice-export-status-filter" label="Export status" />
          <div className="sm:col-span-2">
            <UnsupportedFilter id="invoice-category-filter" label="Category" />
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={handleReset} type="button" variant="outline">Reset</Button>
          <Button onClick={handleApply} type="button">Apply filters</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
