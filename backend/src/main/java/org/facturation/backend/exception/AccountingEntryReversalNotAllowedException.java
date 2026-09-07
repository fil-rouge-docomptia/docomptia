package org.facturation.backend.exception;

public class AccountingEntryReversalNotAllowedException extends RuntimeException {

    public AccountingEntryReversalNotAllowedException(Long accountingEntryId) {
        super("Only an exported accounting entry can be reversed: " + accountingEntryId);
    }

    public AccountingEntryReversalNotAllowedException(Long accountingEntryId, String reason) {
        super("Accounting entry cannot be reversed: " + accountingEntryId + " (" + reason + ")");
    }
}
