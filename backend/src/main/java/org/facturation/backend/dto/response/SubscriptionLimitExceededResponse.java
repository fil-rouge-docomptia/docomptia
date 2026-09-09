package org.facturation.backend.dto.response;

import java.util.List;

public record SubscriptionLimitExceededResponse(
        String code,
        String message,
        String limit,
        int quota,
        long usage,
        List<SubscriptionPlanSuggestionResponse> suggestedPlans
) {
}
