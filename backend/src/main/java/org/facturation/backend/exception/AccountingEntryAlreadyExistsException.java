package org.facturation.backend.exception;

public class AccountingEntryAlreadyExistsException extends RuntimeException {
    private final Long accountingEntryId;

    public AccountingEntryAlreadyExistsException(Long accountingEntryId) {
        super("The invoice already has an original accounting entry");
        this.accountingEntryId = accountingEntryId;
    }

    public Long getAccountingEntryId() { return accountingEntryId; }
}
