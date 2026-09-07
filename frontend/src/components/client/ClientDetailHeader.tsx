import { Pencil } from 'lucide-react'

import { ClientStatusBadge } from '@/components/client/ClientStatusBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import type { Customer } from '@/types/customer'

export function ClientDetailHeader({ customer }: { customer: Customer }) {
  const contact = [customer.email, customer.phone].filter(Boolean).join(' · ')
  return (
    <>
      <PageHeader
        actions={<Button disabled title="This screen currently supports consultation only."><Pencil aria-hidden="true" />Edit client</Button>}
        description="Client profile and legal identification details."
        title={customer.legalName}
      />
      <dl className="grid gap-5 rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:grid-cols-2 xl:grid-cols-[1fr_0.8fr_0.8fr_1.2fr_1.2fr]">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Client / Legal name</dt>
          <dd className="mt-2 space-y-1.5">
            <p className="break-words text-sm font-semibold">{customer.legalName}</p>
            {customer.name !== customer.legalName ? <p className="break-words text-xs text-muted-foreground">Trading name: {customer.name}</p> : null}
            <ClientStatusBadge active={customer.active} />
          </dd>
        </div>
        {[
          ['SIRET', customer.siret],
          ['VAT number', customer.vatNumber],
          ['Address', customer.address],
          ['Contact details', contact],
        ].map(([label, value]) => (
          <div className="min-w-0" key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-3 whitespace-pre-line break-words text-sm">{value || 'Not provided'}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}
