package org.facturation.backend.exception;

import org.facturation.backend.dto.response.SubscriptionPlanSuggestionResponse;

import java.util.List;

public class SubscriptionLimitExceededException extends RuntimeException {

    private final String limit;
    private final int quota;
    private final long usage;
    private final List<SubscriptionPlanSuggestionResponse> suggestedPlans;

    public SubscriptionLimitExceededException(
            String limit,
            int quota,
            long usage,
            List<SubscriptionPlanSuggestionResponse> suggestedPlans
    ) {
        super("Subscription limit " + limit + " reached (" + usage + "/" + quota + ")");
        this.limit = limit;
        this.quota = quota;
        this.usage = usage;
        this.suggestedPlans = List.copyOf(suggestedPlans);
    }

    public String getLimit() {
        return limit;
    }

    public int getQuota() {
        return quota;
    }

    public long getUsage() {
        return usage;
    }

    public List<SubscriptionPlanSuggestionResponse> getSuggestedPlans() {
        return suggestedPlans;
    }
}
