package org.facturation.backend.dto.response;

import java.util.List;

public class AccountingEntryResponse {

    private Long accountingEntryId;
    private Long reversedAccountingEntryId;
    private String entryNumber;
    private String entryDate;
    private String label;
    private String status;
    private String totalDebit;
    private String totalCredit;
    private String balanceDifference;
    private boolean balanced;
    private List<AccountingEntryLineResponse> lines;

    public Long getAccountingEntryId() {
        return accountingEntryId;
    }

    public void setAccountingEntryId(Long accountingEntryId) {
        this.accountingEntryId = accountingEntryId;
    }

    public Long getReversedAccountingEntryId() {
        return reversedAccountingEntryId;
    }

    public void setReversedAccountingEntryId(Long reversedAccountingEntryId) {
        this.reversedAccountingEntryId = reversedAccountingEntryId;
    }

    public String getEntryNumber() {
        return entryNumber;
    }

    public void setEntryNumber(String entryNumber) {
        this.entryNumber = entryNumber;
    }

    public String getEntryDate() {
        return entryDate;
    }

    public void setEntryDate(String entryDate) {
        this.entryDate = entryDate;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getTotalDebit() {
        return totalDebit;
    }

    public void setTotalDebit(String totalDebit) {
        this.totalDebit = totalDebit;
    }

    public String getTotalCredit() {
        return totalCredit;
    }

    public void setTotalCredit(String totalCredit) {
        this.totalCredit = totalCredit;
    }

    public String getBalanceDifference() {
        return balanceDifference;
    }

    public void setBalanceDifference(String balanceDifference) {
        this.balanceDifference = balanceDifference;
    }

    public boolean isBalanced() {
        return balanced;
    }

    public void setBalanced(boolean balanced) {
        this.balanced = balanced;
    }

    public List<AccountingEntryLineResponse> getLines() {
        return lines;
    }

    public void setLines(List<AccountingEntryLineResponse> lines) {
        this.lines = lines;
    }
}
