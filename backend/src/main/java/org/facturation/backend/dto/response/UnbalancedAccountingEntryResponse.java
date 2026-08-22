package org.facturation.backend.dto.response;

public class UnbalancedAccountingEntryResponse extends ApiErrorResponse {

    private final Long accountingEntryId;
    private final String totalDebit;
    private final String totalCredit;
    private final String balanceDifference;

    public UnbalancedAccountingEntryResponse(
            String code,
            String message,
            Long accountingEntryId,
            String totalDebit,
            String totalCredit,
            String balanceDifference
    ) {
        super(code, message);
        this.accountingEntryId = accountingEntryId;
        this.totalDebit = totalDebit;
        this.totalCredit = totalCredit;
        this.balanceDifference = balanceDifference;
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
