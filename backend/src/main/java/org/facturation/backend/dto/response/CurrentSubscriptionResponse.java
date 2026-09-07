package org.facturation.backend.dto.response;

import java.time.LocalDate;

public record CurrentSubscriptionResponse(
        boolean subscribed,
        String status,
        LocalDate nextBillingDate,
        SubscriptionPlanResponse plan
) {
    public static CurrentSubscriptionResponse withoutSubscription() {
        return new CurrentSubscriptionResponse(false, null, null, null);
    }
}
