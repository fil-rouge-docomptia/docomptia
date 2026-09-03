import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader'
import type { DashboardPeriodPreset } from '@/components/dashboard/dashboard-period'
import {
  ReportMetricGrid,
  type ReportMetric,
} from '@/components/report/ReportMetricGrid'
import { ReportSpendingSection } from '@/components/report/ReportSpendingSection'
import { getReportInvoiceListHref } from '@/components/report/report-navigation'
import type { DashboardPeriodQuery, DashboardSummary } from '@/types/dashboard'

type ReportSummaryProps = {
  currencyCode: string
  period: DashboardPeriodQuery
  periodPreset: DashboardPeriodPreset
  summary: DashboardSummary
}

export function ReportSummary({
  currencyCode,
  period,
  periodPreset,
  summary,
}: ReportSummaryProps) {
  const processingMetrics: ReportMetric[] = [
    {
      actionLabel: 'View invoices',
      href: getReportInvoiceListHref(period),
      label: 'Invoice volume',
      value: summary.totals.invoiceCount,
    },
    {
      actionLabel: 'Review processing',
      href: getReportInvoiceListHref(period, ['DEPOSEE']),
      label: 'To process',
      value: summary.workQueues.toProcess,
    },
    {
      actionLabel: 'View approvals',
      href: getReportInvoiceListHref(period, ['A_VERIFIER']),
      label: 'Waiting for approval',
      value: summary.workQueues.awaitingValidation,
    },
    {
      actionLabel: 'View export queue',
      href: getReportInvoiceListHref(period, ['EXPORTABLE']),
      label: 'Ready to export',
      value: summary.workQueues.exportable,
    },
  ]
  const attentionHref = `/dashboard?period=${periodPreset}#processing-issues`
  const operationMetrics: ReportMetric[] = [
    {
      actionLabel: 'Review OCR results',
      href: getReportInvoiceListHref(period, ['ERREUR_OCR']),
      label: 'OCR errors',
      value: summary.alerts.ocrErrors,
    },
    {
      actionLabel: 'Review exceptions',
      href: attentionHref,
      label: 'Possible duplicates',
      value: summary.alerts.pendingDuplicates,
    },
    {
      actionLabel: 'Review exceptions',
      href: attentionHref,
      label: 'Unbalanced entries',
      value: summary.alerts.unbalancedAccountingEntries,
    },
  ]

  return (
    <div className="space-y-8">
      <section aria-labelledby="report-processing-title">
        <DashboardSectionHeader
          description="Current volume and queues for the selected date range."
          title="Invoice processing"
          titleId="report-processing-title"
        />
        <ReportMetricGrid ariaLabel="Invoice processing metrics" metrics={processingMetrics} />
      </section>

      <ReportSpendingSection currencyCode={currencyCode} summary={summary} />

      <section aria-labelledby="report-operations-title">
        <DashboardSectionHeader
          description="Exceptions and controls that require attention."
          title="Operations"
          titleId="report-operations-title"
        />
        <ReportMetricGrid
          ariaLabel="Operational metrics"
          columns={3}
          metrics={operationMetrics}
        />
      </section>
    </div>
  )
}
