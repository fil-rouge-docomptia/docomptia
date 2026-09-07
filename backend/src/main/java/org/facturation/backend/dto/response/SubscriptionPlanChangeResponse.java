package org.facturation.backend.dto.response;

import java.time.LocalDate;

public record SubscriptionPlanChangeResponse(
        String changeType,
        LocalDate effectiveDate,
        SubscriptionPlanResponse plan
) {
}
