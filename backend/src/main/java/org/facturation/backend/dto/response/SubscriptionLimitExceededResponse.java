package org.facturation.backend.dto.response;

public record SubscriptionLimitExceededResponse(
        String code,
        String message,
        String limit,
        int quota,
        long usage
) {
}
