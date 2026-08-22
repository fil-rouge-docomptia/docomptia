package org.facturation.backend.exception;

public class AccountingEntryNotModifiableException extends RuntimeException {

    public AccountingEntryNotModifiableException(Long accountingEntryId) {
        super("Accounting entry " + accountingEntryId + " is not modifiable");
    }
}
