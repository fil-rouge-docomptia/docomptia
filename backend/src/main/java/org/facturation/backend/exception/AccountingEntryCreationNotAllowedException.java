package org.facturation.backend.exception;

public class AccountingEntryCreationNotAllowedException extends RuntimeException {
    public AccountingEntryCreationNotAllowedException(String message) { super(message); }
}
