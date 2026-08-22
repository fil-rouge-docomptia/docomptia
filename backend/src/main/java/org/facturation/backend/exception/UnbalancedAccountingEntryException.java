package org.facturation.backend.exception;

import org.facturation.backend.dto.response.AccountingEntryResponse;

public class UnbalancedAccountingEntryException extends RuntimeException {

    private final Long accountingEntryId;
    private final String totalDebit;
    private final String totalCredit;
    private final String balanceDifference;

    public UnbalancedAccountingEntryException(AccountingEntryResponse accountingEntry) {
        super("Accounting entry " + accountingEntry.getAccountingEntryId() + " is not balanced");
        this.accountingEntryId = accountingEntry.getAccountingEntryId();
        this.totalDebit = accountingEntry.getTotalDebit();
        this.totalCredit = accountingEntry.getTotalCredit();
        this.balanceDifference = accountingEntry.getBalanceDifference();
    }

    public Long getAccountingEntryId() {
        return accountingEntryId;
    }

    public String getTotalDebit() {
        return totalDebit;
    }

    public String getTotalCredit() {
        return totalCredit;
    }

    public String getBalanceDifference() {
        return balanceDifference;
    }
}
