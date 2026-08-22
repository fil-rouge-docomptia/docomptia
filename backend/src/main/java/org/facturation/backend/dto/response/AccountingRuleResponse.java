package org.facturation.backend.dto.response;

public class AccountingRuleResponse {
    private Long accountingRuleId;
    private String ruleName;
    private AccountingRuleAccountResponse expenseAccount;
    private AccountingRuleAccountResponse vatAccount;
    private AccountingRuleAccountResponse supplierAccount;
    private boolean active;
    private boolean configurationComplete;

    public Long getAccountingRuleId() { return accountingRuleId; }
    public void setAccountingRuleId(Long accountingRuleId) { this.accountingRuleId = accountingRuleId; }
    public String getRuleName() { return ruleName; }
    public void setRuleName(String ruleName) { this.ruleName = ruleName; }
    public AccountingRuleAccountResponse getExpenseAccount() { return expenseAccount; }
    public void setExpenseAccount(AccountingRuleAccountResponse expenseAccount) { this.expenseAccount = expenseAccount; }
    public AccountingRuleAccountResponse getVatAccount() { return vatAccount; }
    public void setVatAccount(AccountingRuleAccountResponse vatAccount) { this.vatAccount = vatAccount; }
    public AccountingRuleAccountResponse getSupplierAccount() { return supplierAccount; }
    public void setSupplierAccount(AccountingRuleAccountResponse supplierAccount) { this.supplierAccount = supplierAccount; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isConfigurationComplete() { return configurationComplete; }
    public void setConfigurationComplete(boolean configurationComplete) { this.configurationComplete = configurationComplete; }
}
