package org.facturation.backend.exception;

public class AccountingEntryLineNotFoundException extends RuntimeException {

    public AccountingEntryLineNotFoundException(Long accountingEntryId, Long lineId) {
        super("Accounting entry line " + lineId + " not found for accounting entry " + accountingEntryId);
    }
}
