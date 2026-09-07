package org.facturation.backend.exception;

public class SubscriptionLimitExceededException extends RuntimeException {

    private final String limit;
    private final int quota;
    private final long usage;

    public SubscriptionLimitExceededException(String limit, int quota, long usage) {
        super("Subscription limit " + limit + " reached (" + usage + "/" + quota + ")");
        this.limit = limit;
        this.quota = quota;
        this.usage = usage;
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
}
