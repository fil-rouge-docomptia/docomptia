package org.facturation.backend.dto.response;

public record SubscriptionLimitDifferenceResponse(
        String limit,
        Integer currentValue,
        Integer suggestedValue
) {
}
