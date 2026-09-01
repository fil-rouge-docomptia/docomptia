export type DashboardPeriod = {
  endDate: string | null
  startDate: string | null
}

export type DashboardTotals = {
  invoiceCount: number
  totalHt: number
  totalTtc: number
  totalTva: number
}

export type DashboardWorkQueues = {
  awaitingValidation: number
  exportable: number
  toProcess: number
  toVerify: number
}

export type DashboardAlerts = {
  ocrErrors: number
  pendingDuplicates: number
  unbalancedAccountingEntries: number
}

export type DashboardStatusCount = {
  count: number
  status: string
}

export type DashboardSummary = {
  alerts: DashboardAlerts
  period: DashboardPeriod
  statusDistribution: DashboardStatusCount[]
  totals: DashboardTotals
  workQueues: DashboardWorkQueues
}

export type DashboardPeriodQuery = {
  endDate: string
  startDate: string
}
