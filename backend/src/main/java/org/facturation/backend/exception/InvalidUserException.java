package org.facturation.backend.exception;

public class InvalidUserException extends IllegalArgumentException {

    public InvalidUserException(String message) {
        super(message);
    }
}
