package org.facturation.backend.dto.response;

import java.util.List;

public record DashboardSummaryResponse(
        DashboardPeriodResponse period,
        DashboardTotalsResponse totals,
        DashboardWorkQueuesResponse workQueues,
        DashboardAlertsResponse alerts,
        List<DashboardStatusCountResponse> statusDistribution,
        List<DashboardActionRequiredInvoiceResponse> actionRequiredInvoices
) {
}
