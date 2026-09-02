import { Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { SupplierDetails } from '@/types/supplier'

export function SupplierAccountingTab({ supplier }: { supplier: SupplierDetails }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Accounting defaults</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Accounts and automation used for {supplier.legalName}.
        </p>
      </div>

      <Card className="shadow-elevation-1">
        <CardHeader className="flex-row items-start justify-between space-y-0 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Settings aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-medium">Supplier accounting configuration</h3>
              <p className="mt-1 text-xs text-muted-foreground">No supplier-specific rule is available.</p>
            </div>
          </div>
          <Badge variant="secondary">Not configured</Badge>
        </CardHeader>
        <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
          <p>
            The current API only exposes organization-wide accounting rules. Configure those defaults
            from the Accounting module until supplier-specific settings become available.
          </p>
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link to="/accounting">Open Accounting</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
