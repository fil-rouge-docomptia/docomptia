package org.facturation.backend.exception;

public class AccountingEntryNotFoundException extends RuntimeException {

    public AccountingEntryNotFoundException(Long accountingEntryId) {
        super("Accounting entry not found: " + accountingEntryId);
    }
}
