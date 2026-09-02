import { Badge } from '@/components/ui/badge'
import { formatSupplierDate, legalIdentifierLabel } from '@/components/supplier/detail/supplier-detail-utils'
import type { SupplierDetails } from '@/types/supplier'

export function SupplierActivityTab({ supplier }: { supplier: SupplierDetails }) {
  const identifierEvents = [...supplier.legalIdentifierHistory]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Supplier activity</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Auditable history of supplier identity changes.
        </p>
      </div>

      <div className="space-y-2">
        {identifierEvents.map((identifier) => (
          <article
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-elevation-1"
            key={`${identifier.identifierId}-${identifier.updatedAt}`}
          >
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-foreground">
                {legalIdentifierLabel(identifier)} {identifier.validTo ? 'replaced' : 'recorded'}
              </h3>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {formatSupplierDate(identifier.updatedAt)} · {identifier.value}
                {identifier.changeReason ? ` · ${identifier.changeReason}` : ''}
              </p>
            </div>
            <Badge variant={identifier.validTo ? 'secondary' : 'outline'}>
              {identifier.validTo ? 'Replaced' : identifier.verified ? 'Verified' : 'Recorded'}
            </Badge>
          </article>
        ))}

        <article className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-elevation-1">
          <div>
            <h3 className="text-sm font-medium text-foreground">Supplier profile created</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatSupplierDate(supplier.createdAt)} · {supplier.legalName}
            </p>
          </div>
          <Badge variant="secondary">Created</Badge>
        </article>
      </div>
    </div>
  )
}
