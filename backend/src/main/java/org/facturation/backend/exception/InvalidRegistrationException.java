package org.facturation.backend.exception;

public class InvalidRegistrationException extends IllegalArgumentException {

    public InvalidRegistrationException(String message) {
        super(message);
    }
}
