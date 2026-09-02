import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getLegalIdentifierValue } from '@/components/supplier/detail/supplier-detail-utils'
import type { SupplierDetails } from '@/types/supplier'

type SupplierDetailHeaderProps = {
  canEdit: boolean
  onEdit: () => void
  supplier: SupplierDetails
}

function DetailValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 break-words text-xs font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

export function SupplierDetailHeader({ canEdit, onEdit, supplier }: SupplierDetailHeaderProps) {
  const contact = [supplier.email, supplier.phone].filter(Boolean).join(' · ')

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.75px] text-foreground">
            {supplier.legalName}
          </h1>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Supplier profile and accounting defaults.
          </p>
        </div>

        {canEdit ? (
          <Button className="self-start sm:self-auto" onClick={onEdit} type="button">
            <Pencil aria-hidden="true" />
            Edit supplier
          </Button>
        ) : null}
      </header>

      <dl className="grid gap-5 rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:grid-cols-2 xl:grid-cols-[1fr_0.75fr_0.75fr_1.25fr_1.15fr]">
        <DetailValue label="Supplier name" value={supplier.tradeName || supplier.name} />
        <DetailValue label="SIRET" value={getLegalIdentifierValue(supplier, 'FR_SIRET')} />
        <DetailValue label="VAT number" value={getLegalIdentifierValue(supplier, 'EU_VAT')} />
        <DetailValue label="Address" value={supplier.address} />
        <DetailValue label="Main contact" value={contact || null} />
      </dl>
    </>
  )
}
