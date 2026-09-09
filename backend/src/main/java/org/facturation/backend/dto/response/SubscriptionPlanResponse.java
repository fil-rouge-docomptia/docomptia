package org.facturation.backend.dto.response;

import java.util.List;

public record SubscriptionPlanResponse(
        String code,
        String name,
        Integer maxActiveUsers,
        Integer monthlyInvoiceLimit,
        List<String> features
) {
}
