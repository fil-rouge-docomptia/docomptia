import { type FormEvent, useState } from 'react'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { inboxViews, type InboxView } from '@/components/invoice/inbox-filter'

type InboxToolbarProps = {
  invoiceNumber: string
  onInvoiceNumberChange: (value: string) => void
  onSupplierChange: (value: string) => void
  onViewChange: (view: InboxView) => void
  supplier: string
  view: InboxView
}

export function InboxToolbar({
  invoiceNumber,
  onInvoiceNumberChange,
  onSupplierChange,
  onViewChange,
  supplier,
  view,
}: InboxToolbarProps) {
  const [supplierDraft, setSupplierDraft] = useState(supplier)
  const [supplierOpen, setSupplierOpen] = useState(false)

  const handleInvoiceSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onInvoiceNumberChange(String(data.get('invoiceNumber') ?? '').trim())
  }

  const handleSupplierOpenChange = (open: boolean) => {
    if (open) {
      setSupplierDraft(supplier)
    }
    setSupplierOpen(open)
  }

  const handleSupplierSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSupplierChange(supplierDraft.trim())
    setSupplierOpen(false)
  }

  return (
    <section aria-label="Inbox filters" className="space-y-4">
      <Tabs onValueChange={(value) => onViewChange(value as InboxView)} value={view}>
        <TabsList
          aria-label="Inbox status"
          className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
        >
          {inboxViews.map((option) => (
            <TabsTrigger
              className="h-10 rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form className="relative w-full sm:max-w-sm" onSubmit={handleInvoiceSearch}>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search inbox"
            className="h-10 pl-9 pr-9"
            defaultValue={invoiceNumber}
            key={invoiceNumber}
            name="invoiceNumber"
            placeholder="Search inbox…"
            type="search"
          />
          {invoiceNumber ? (
            <Button
              aria-label="Clear inbox search"
              className="absolute right-0 top-0 size-10 text-muted-foreground"
              onClick={() => onInvoiceNumberChange('')}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
        </form>

        <Popover onOpenChange={handleSupplierOpenChange} open={supplierOpen}>
          <PopoverTrigger asChild>
            <Button className="w-full sm:w-auto" type="button" variant="outline">
              {supplier ? `Supplier: ${supplier}` : 'Supplier'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-4">
            <form className="space-y-3" onSubmit={handleSupplierSubmit}>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="inbox-supplier-filter">
                  Supplier
                </Label>
                <Input
                  autoFocus
                  id="inbox-supplier-filter"
                  onChange={(event) => setSupplierDraft(event.target.value)}
                  placeholder="Name, SIREN, SIRET or VAT number"
                  value={supplierDraft}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setSupplierDraft('')}
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
      </div>
    </section>
  )
}
