import { InvoiceAccountingTab } from '@/components/invoice/detail/InvoiceAccountingTab'
import { InvoiceActivityTab } from '@/components/invoice/detail/InvoiceActivityTab'
import { InvoiceApprovalTab } from '@/components/invoice/detail/InvoiceApprovalTab'
import { InvoiceDetailsTab } from '@/components/invoice/detail/InvoiceDetailsTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { RoleCode } from '@/types/auth'
import type {
  InvoiceDetails,
  InvoiceDuplicateAlert,
  InvoiceDuplicateDecision,
} from '@/types/invoice'

import { canCorrectInvoice, canProcessInvoice } from './invoice-detail-utils'

export type InvoiceDetailTab = 'accounting' | 'activity' | 'approval' | 'details'

type CorrectionState = {
  dirty: boolean
  saving: boolean
}

type InvoiceWorkflowPanelProps = {
  activeTab: InvoiceDetailTab
  duplicateAlert: InvoiceDuplicateAlert | null
  duplicateDecisionError: boolean
  duplicateDecisionPending: InvoiceDuplicateDecision | null
  historyNeedsRefresh: boolean
  invoice: InvoiceDetails
  onActiveTabChange: (tab: InvoiceDetailTab) => void
  onCorrectionStateChange: (state: CorrectionState) => void
  onIgnoreDuplicate: () => Promise<void>
  onInvoiceUpdated: (invoice: InvoiceDetails, historyNeedsRefresh?: boolean) => void
  onReviewDuplicate: () => void
  role?: RoleCode
}

const tabClassName =
  'h-11 rounded-md border border-transparent px-3 py-2 text-xs font-medium shadow-none sm:text-sm lg:h-9 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-elevation-1'

export function InvoiceWorkflowPanel({
  activeTab,
  duplicateAlert,
  duplicateDecisionError,
  duplicateDecisionPending,
  historyNeedsRefresh,
  invoice,
  onActiveTabChange,
  onCorrectionStateChange,
  onIgnoreDuplicate,
  onInvoiceUpdated,
  onReviewDuplicate,
  role,
}: InvoiceWorkflowPanelProps) {
  return (
    <Tabs
      className="flex min-h-[42rem] min-w-0 flex-col bg-card xl:h-[49rem]"
      onValueChange={(value) => onActiveTabChange(value as InvoiceDetailTab)}
      value={activeTab}
    >
      <div className="overflow-x-auto border-b border-border px-2 py-2">
        <TabsList className="h-11 min-w-max justify-start gap-1 rounded-none bg-transparent p-0 lg:h-9">
          <TabsTrigger className={tabClassName} value="details">Details</TabsTrigger>
          <TabsTrigger className={tabClassName} value="accounting">Accounting</TabsTrigger>
          <TabsTrigger className={tabClassName} value="approval">Approval</TabsTrigger>
          <TabsTrigger className={tabClassName} value="activity">Activity</TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabsContent className="m-0 focus-visible:ring-inset" value="details">
          <InvoiceDetailsTab
            canEdit={canCorrectInvoice(invoice.status, role)}
            canProcessDuplicate={canProcessInvoice(role)}
            duplicateAlert={duplicateAlert}
            duplicateDecisionError={duplicateDecisionError}
            duplicateDecisionPending={Boolean(duplicateDecisionPending)}
            invoice={invoice}
            onCorrectionStateChange={onCorrectionStateChange}
            onIgnoreDuplicate={onIgnoreDuplicate}
            onInvoiceUpdated={onInvoiceUpdated}
            onReviewDuplicate={onReviewDuplicate}
          />
        </TabsContent>
        <TabsContent className="m-0 focus-visible:ring-inset" value="accounting">
          <InvoiceAccountingTab
            invoice={invoice}
            onInvoiceUpdated={(updatedInvoice) => onInvoiceUpdated(updatedInvoice, true)}
          />
        </TabsContent>
        <TabsContent className="m-0 focus-visible:ring-inset" value="approval">
          <InvoiceApprovalTab
            invoice={invoice}
            onEditInvoice={() => onActiveTabChange('details')}
            onStatusChanged={(status) => onInvoiceUpdated({ ...invoice, status }, true)}
            role={role}
          />
        </TabsContent>
        <TabsContent className="m-0 focus-visible:ring-inset" value="activity">
          <InvoiceActivityTab
            history={historyNeedsRefresh ? null : invoice.history}
            invoiceId={invoice.invoiceId}
          />
        </TabsContent>
      </div>
    </Tabs>
  )
}
