package org.facturation.backend.exception;

public class AccountingEntryMutationConflictException extends RuntimeException {
    public AccountingEntryMutationConflictException(String message) { super(message); }
}
