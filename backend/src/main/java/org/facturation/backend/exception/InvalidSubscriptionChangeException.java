package org.facturation.backend.exception;

public class InvalidSubscriptionChangeException extends RuntimeException {

    public InvalidSubscriptionChangeException(String message) {
        super(message);
    }
}
