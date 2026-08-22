package org.facturation.backend.exception;

public class ChartOfAccountConflictException extends RuntimeException {

    public ChartOfAccountConflictException(String accountNumber) {
        super("Account number " + accountNumber + " is already used in the organization");
    }
}
