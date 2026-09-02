import type { KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SupplierLegalIdentifier, SupplierListItem } from '@/types/supplier'

function currentIdentifier(
  supplier: SupplierListItem,
  scheme: 'EU_VAT' | 'FR_SIRET',
) {
  const identifier = supplier.currentLegalIdentifiers.find((item) => item.scheme === scheme)
  if (identifier) {
    return identifier.value
  }

  return scheme === 'FR_SIRET' ? supplier.siret : supplier.vatNumber
}

function otherIdentifiers(supplier: SupplierListItem) {
  return supplier.currentLegalIdentifiers.filter(
    (identifier) => !['EU_VAT', 'FR_SIRET'].includes(identifier.scheme),
  )
}

function identifierLabel(identifier: SupplierLegalIdentifier) {
  return `${identifier.countryCode} · ${identifier.scheme.replaceAll('_', ' ')}`
}

type SupplierTableProps = {
  suppliers: SupplierListItem[]
}

export function SupplierTable({ suppliers }: SupplierTableProps) {
  const navigate = useNavigate()
  const openSupplier = (supplierId: number) => navigate(`/suppliers/${supplierId}`)
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    supplierId: number,
  ) => {
    if (event.key === 'Enter') {
      openSupplier(supplierId)
    }
  }

  return (
    <Table className="min-w-[980px]">
      <TableHeader className="bg-muted/70">
        <TableRow className="h-10 hover:bg-transparent">
          <TableHead className="h-10 px-4 text-xs">Supplier</TableHead>
          <TableHead className="h-10 px-4 text-xs">SIRET</TableHead>
          <TableHead className="h-10 px-4 text-xs">VAT number</TableHead>
          <TableHead className="h-10 px-4 text-xs">Other legal identifiers</TableHead>
          <TableHead className="h-10 px-4 text-xs">Country</TableHead>
          <TableHead className="h-10 px-4 text-right text-xs">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suppliers.map((supplier) => {
          const siret = currentIdentifier(supplier, 'FR_SIRET')
          const vatNumber = currentIdentifier(supplier, 'EU_VAT')
          const identifiers = otherIdentifiers(supplier)
          const tradeName = supplier.tradeName || supplier.name
          const showTradeName = tradeName && tradeName !== supplier.legalName

          return (
            <TableRow
              aria-label={`Open supplier ${supplier.legalName}`}
              className="h-14 cursor-pointer focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              key={supplier.supplierId}
              onClick={() => openSupplier(supplier.supplierId)}
              onKeyDown={(event) => handleRowKeyDown(event, supplier.supplierId)}
              role="link"
              tabIndex={0}
            >
              <TableCell className="h-14 max-w-56 px-4 py-2">
                <span className="block truncate text-xs font-medium text-foreground">
                  {supplier.legalName}
                </span>
                {showTradeName ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {tradeName}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="h-14 whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                {siret ?? '—'}
              </TableCell>
              <TableCell className="h-14 whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                {vatNumber ?? '—'}
              </TableCell>
              <TableCell className="h-14 px-4 py-2">
                {identifiers.length ? (
                  <div className="flex max-w-64 flex-wrap gap-1.5">
                    {identifiers.map((identifier) => (
                      <Badge
                        className="gap-1 border-border bg-background font-normal text-foreground"
                        key={identifier.identifierId}
                        title={identifierLabel(identifier)}
                        variant="outline"
                      >
                        <span className="text-muted-foreground">{identifier.scheme}</span>
                        {identifier.value}
                      </Badge>
                    ))}
                  </div>
                ) : '—'}
              </TableCell>
              <TableCell className="h-14 px-4 py-2 text-xs text-muted-foreground">
                {supplier.countryCode ?? '—'}
              </TableCell>
              <TableCell className="h-14 px-2 py-2 text-right">
                <Button
                  aria-label={`Open supplier ${supplier.legalName}`}
                  className="text-primary hover:text-primary"
                  onClick={(event) => {
                    event.stopPropagation()
                    openSupplier(supplier.supplierId)
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Open
                  <ChevronRight aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
