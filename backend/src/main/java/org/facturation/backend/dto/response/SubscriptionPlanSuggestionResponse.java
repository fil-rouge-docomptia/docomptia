package org.facturation.backend.dto.response;

import java.util.List;

public record SubscriptionPlanSuggestionResponse(
        SubscriptionPlanResponse plan,
        List<SubscriptionLimitDifferenceResponse> limitDifferences,
        List<String> addedFeatures
) {
}
