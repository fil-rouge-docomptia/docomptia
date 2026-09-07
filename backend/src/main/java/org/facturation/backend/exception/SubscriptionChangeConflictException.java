package org.facturation.backend.exception;

public class SubscriptionChangeConflictException extends RuntimeException {

    public SubscriptionChangeConflictException(String message) {
        super(message);
    }
}
