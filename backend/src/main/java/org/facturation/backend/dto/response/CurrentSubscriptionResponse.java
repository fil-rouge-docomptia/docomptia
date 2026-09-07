package org.facturation.backend.dto.response;

import java.time.LocalDate;

public record CurrentSubscriptionResponse(
        boolean subscribed,
        String status,
        LocalDate nextBillingDate,
        SubscriptionPlanResponse plan,
        SubscriptionUsageResponse usage
) {
    public static CurrentSubscriptionResponse withoutSubscription() {
        return new CurrentSubscriptionResponse(false, null, null, null, null);
    }
}
