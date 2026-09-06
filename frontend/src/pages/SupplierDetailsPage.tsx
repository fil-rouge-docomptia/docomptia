import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { SupplierAccountingTab } from '@/components/supplier/detail/SupplierAccountingTab'
import { SupplierActivityTab } from '@/components/supplier/detail/SupplierActivityTab'
import { SupplierDetailHeader } from '@/components/supplier/detail/SupplierDetailHeader'
import { SupplierEditDialog } from '@/components/supplier/detail/SupplierEditDialog'
import { SupplierInvoicesTab } from '@/components/supplier/detail/SupplierInvoicesTab'
import { SupplierOverviewTab } from '@/components/supplier/detail/SupplierOverviewTab'
import { canManageSupplier } from '@/components/supplier/detail/supplier-detail-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { getSupplierDetails } from '@/services/supplier'
import type { SupplierDetails } from '@/types/supplier'

type SupplierDetailTab = 'accounting' | 'activity' | 'invoices' | 'overview'

const supplierTabs: SupplierDetailTab[] = ['overview', 'invoices', 'accounting', 'activity']

function parseTab(value: string | null): SupplierDetailTab {
  return supplierTabs.includes(value as SupplierDetailTab)
    ? value as SupplierDetailTab
    : 'overview'
}

function SupplierDetailsSkeleton() {
  return (
    <div aria-label="Loading supplier details" className="space-y-6">
      <div>
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="mt-2 h-5 w-64 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-24" key={index} />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

export default function SupplierDetailsPage() {
  const { supplierId: supplierIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [requestState, setRequestState] = useState<{
    error: boolean
    requestKey: string
    supplier: SupplierDetails | null
  }>({ error: false, requestKey: '', supplier: null })
  const [retryCount, setRetryCount] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const supplierId = Number(supplierIdParam)
  const validSupplierId = Number.isInteger(supplierId) && supplierId > 0
  const requestKey = `${supplierIdParam}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const error = !validSupplierId || (currentRequest && requestState.error)
  const supplier = currentRequest ? requestState.supplier : null
  const activeTab = parseTab(searchParams.get('tab'))

  useEffect(() => {
    if (!validSupplierId) {
      return
    }

    const controller = new AbortController()

    getSupplierDetails(supplierId, controller.signal)
      .then((response) => {
        setRequestState({ error: false, requestKey, supplier: response })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({ error: true, requestKey, supplier: null })
        }
      })

    return () => controller.abort()
  }, [requestKey, supplierId, validSupplierId])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pt-6">
        <Button asChild size="sm" variant="ghost">
          <Link to="/suppliers">
            <ArrowLeft aria-hidden="true" />
            Back to suppliers
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load supplier</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Check that the supplier exists and try again.</p>
            {validSupplierId ? (
              <Button onClick={() => setRetryCount((count) => count + 1)} size="sm" type="button" variant="outline">
                Try again
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!supplier) {
    return <SupplierDetailsSkeleton />
  }

  return (
    <div className="space-y-6">
      <SupplierDetailHeader
        canEdit={canManageSupplier(user?.permissions)}
        onEdit={() => setEditOpen(true)}
        supplier={supplier}
      />

      <Tabs
        onValueChange={(value) => {
          const nextTab = parseTab(value)
          setSearchParams(nextTab === 'overview' ? {} : { tab: nextTab })
        }}
        value={activeTab}
      >
        <TabsList className="grid h-10 w-full max-w-md grid-cols-4 gap-1 bg-transparent p-0">
          {supplierTabs.map((tab) => (
            <TabsTrigger
              className="h-10 bg-muted px-3 text-xs capitalize data-[state=active]:border data-[state=active]:border-border"
              key={tab}
              value={tab}
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent className="mt-5" value="overview">
          <SupplierOverviewTab
            onViewInvoices={() => setSearchParams({ tab: 'invoices' })}
            supplier={supplier}
          />
        </TabsContent>
        <TabsContent className="mt-5" value="invoices">
          <SupplierInvoicesTab supplier={supplier} />
        </TabsContent>
        <TabsContent className="mt-5" value="accounting">
          <SupplierAccountingTab supplier={supplier} />
        </TabsContent>
        <TabsContent className="mt-5" value="activity">
          <SupplierActivityTab supplier={supplier} />
        </TabsContent>
      </Tabs>

      {editOpen ? (
        <SupplierEditDialog
          onOpenChange={setEditOpen}
          onUpdated={(updatedSupplier) => {
            setRequestState({ error: false, requestKey, supplier: updatedSupplier })
          }}
          open
          supplier={supplier}
        />
      ) : null}
    </div>
  )
}
