import { Files, ReceiptText, Search, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type GlobalSearchDialogProps = {
  onOpenChange: (open: boolean) => void
  open: boolean
}

const searchAlternatives = [
  { icon: ReceiptText, label: 'Search invoices', path: '/invoices' },
  { icon: Truck, label: 'Search suppliers', path: '/suppliers' },
  { icon: Files, label: 'Search documents', path: '/documents' },
]

export function GlobalSearchDialog({ onOpenChange, open }: GlobalSearchDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="px-6 pb-4 pt-6 text-left">
          <DialogTitle>Global search</DialogTitle>
          <DialogDescription>
            Find invoices, suppliers and documents from one place.
          </DialogDescription>
        </DialogHeader>

        <div className="relative border-y bg-muted/30 px-6 py-4">
          <Input
            aria-label="Global search unavailable"
            className="h-11 bg-background pl-10 shadow-elevation-1"
            disabled
            placeholder="Search invoices, suppliers and documents…"
            type="search"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-9 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>

        <div className="px-6 py-6">
          <div className="rounded-lg border border-dashed bg-muted/30 p-5 text-center">
            <p className="font-medium text-foreground">Global search is not available yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              The shared search service is still being prepared. You can continue using the
              focused search available in each module.
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {searchAlternatives.map((alternative) => {
              const Icon = alternative.icon

              return (
                <Button
                  asChild
                  className="h-auto min-h-11 justify-start gap-2 whitespace-normal px-3 py-2"
                  key={alternative.path}
                  variant="outline"
                >
                  <Link onClick={() => onOpenChange(false)} to={alternative.path}>
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {alternative.label}
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
