package org.facturation.backend.dto.response;

import java.time.LocalDate;

public record SubscriptionUsageResponse(
        LocalDate periodStart,
        LocalDate periodEnd,
        long activeUsers,
        long monthlyInvoices
) {
}
