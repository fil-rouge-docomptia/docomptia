package org.facturation.backend.dto.response;

public record DashboardAlertsResponse(
        long ocrErrors,
        long pendingDuplicates,
        long unbalancedAccountingEntries
) {
}
