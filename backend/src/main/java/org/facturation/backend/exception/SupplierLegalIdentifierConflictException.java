package org.facturation.backend.exception;

public class SupplierLegalIdentifierConflictException extends RuntimeException {

    public SupplierLegalIdentifierConflictException(String fieldName) {
        super("Another supplier in the organization already uses this " + fieldName);
    }
}
