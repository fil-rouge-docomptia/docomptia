import { useEffect, useState } from 'react'
import { AlertCircle, Check, ChevronsUpDown, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { listSuppliers } from '@/services/supplier'
import type { SupplierListItem } from '@/types/supplier'

const SUPPLIER_RESULT_LIMIT = 20

export type SupplierComboboxValue = {
  countryCode: string | null
  identifiers: string[]
  legalName: string
  supplierId: number
  tradeName: string | null
}

type SupplierRequestState = {
  error: boolean
  requestKey: string
  suppliers: SupplierListItem[]
}

function identifierLabel(scheme: string) {
  if (scheme === 'FR_SIRET') {
    return 'SIRET'
  }

  if (scheme === 'EU_VAT') {
    return 'VAT'
  }

  return scheme.replaceAll('_', ' ')
}

function getSupplierIdentifiers(supplier: SupplierListItem) {
  const identifiers = supplier.currentLegalIdentifiers
    .filter((identifier) => !identifier.validTo)
    .map((identifier) => `${identifierLabel(identifier.scheme)} ${identifier.value}`)

  if (supplier.siret && !identifiers.some((identifier) => identifier.includes(supplier.siret!))) {
    identifiers.push(`SIRET ${supplier.siret}`)
  }

  if (
    supplier.vatNumber
    && !identifiers.some((identifier) => identifier.includes(supplier.vatNumber!))
  ) {
    identifiers.push(`VAT ${supplier.vatNumber}`)
  }

  return Array.from(new Set(identifiers)).slice(0, 2)
}

function toComboboxValue(supplier: SupplierListItem): SupplierComboboxValue {
  return {
    countryCode: supplier.countryCode,
    identifiers: getSupplierIdentifiers(supplier),
    legalName: supplier.legalName,
    supplierId: supplier.supplierId,
    tradeName: supplier.tradeName || supplier.name,
  }
}

function SupplierSummary({ value }: { value: SupplierComboboxValue }) {
  const tradeNameVisible = value.tradeName && value.tradeName !== value.legalName
  const details = [value.countryCode, ...value.identifiers].filter(Boolean).join(' · ')

  return (
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-sm font-medium text-foreground">
        {value.legalName}
      </span>
      {tradeNameVisible ? (
        <span className="block truncate text-xs text-muted-foreground">{value.tradeName}</span>
      ) : null}
      <span className="block truncate text-xs text-muted-foreground">
        {details || 'No legal identifier available'}
      </span>
    </span>
  )
}

type SupplierComboboxProps = {
  disabled?: boolean
  id?: string
  onValueChange: (supplier: SupplierComboboxValue) => void
  value: SupplierComboboxValue | null
}

export function SupplierCombobox({
  disabled = false,
  id,
  onValueChange,
  value,
}: SupplierComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [requestState, setRequestState] = useState<SupplierRequestState>({
    error: false,
    requestKey: '',
    suppliers: [],
  })
  const requestKey = `${query.trim()}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const loading = open && !currentRequest
  const error = currentRequest && requestState.error
  const suppliers = currentRequest ? requestState.suppliers : []

  useEffect(() => {
    if (!open) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      listSuppliers(
        {
          page: 0,
          query: query.trim() || undefined,
          size: SUPPLIER_RESULT_LIMIT,
        },
        controller.signal,
      )
        .then((supplierPage) => {
          setRequestState({
            error: false,
            requestKey,
            suppliers: supplierPage.content,
          })
        })
        .catch((requestError: unknown) => {
          if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
            setRequestState({ error: true, requestKey, suppliers: [] })
          }
        })
    }, 200)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [open, query, requestKey])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery('')
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-invalid={!value}
          aria-label="Supplier"
          aria-required="true"
          className={cn(
            'h-auto min-h-9 w-full justify-between gap-3 border-input px-3 py-2 font-normal',
            !value && 'border-destructive text-destructive focus-visible:ring-destructive',
          )}
          disabled={disabled}
          id={id}
          role="combobox"
          type="button"
          variant="outline"
        >
          {value ? (
            <SupplierSummary value={value} />
          ) : (
            <span className="text-sm text-muted-foreground">No supplier selected</span>
          )}
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            aria-label="Search suppliers"
            onValueChange={setQuery}
            placeholder="Search by legal name, SIRET or VAT…"
            value={query}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground" role="status">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Searching suppliers…
              </div>
            ) : error ? (
              <div className="space-y-3 px-4 py-5 text-center">
                <p className="flex items-center justify-center gap-2 text-sm text-destructive">
                  <AlertCircle aria-hidden="true" className="size-4" />
                  Unable to load suppliers
                </p>
                <Button
                  onClick={() => setRetryCount((count) => count + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Try again
                </Button>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground">No suppliers found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try another legal name, SIRET or VAT number.
                </p>
              </div>
            ) : (
              <CommandGroup heading="Suppliers in your organization">
                {suppliers.map((supplier) => {
                  const option = toComboboxValue(supplier)
                  const selected = option.supplierId === value?.supplierId

                  return (
                    <CommandItem
                      aria-label={`Select supplier ${option.legalName}`}
                      className="items-start py-2.5"
                      key={option.supplierId}
                      onSelect={() => {
                        onValueChange(option)
                        handleOpenChange(false)
                      }}
                      value={String(option.supplierId)}
                    >
                      <Check
                        aria-hidden="true"
                        className={cn('mt-0.5 size-4', selected ? 'opacity-100' : 'opacity-0')}
                      />
                      <SupplierSummary value={option} />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
