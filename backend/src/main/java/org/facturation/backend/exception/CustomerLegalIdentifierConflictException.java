package org.facturation.backend.exception;

public class CustomerLegalIdentifierConflictException extends RuntimeException {

    public CustomerLegalIdentifierConflictException(String fieldName) {
        super("Another customer in the organization already uses this " + fieldName);
    }
}
