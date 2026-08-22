package org.facturation.backend.dto.response;

public class AccountingRuleAccountResponse {
    private Long accountId;
    private String accountNumber;
    private String accountLabel;
    private boolean active;

    public Long getAccountId() { return accountId; }
    public void setAccountId(Long accountId) { this.accountId = accountId; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public String getAccountLabel() { return accountLabel; }
    public void setAccountLabel(String accountLabel) { this.accountLabel = accountLabel; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
