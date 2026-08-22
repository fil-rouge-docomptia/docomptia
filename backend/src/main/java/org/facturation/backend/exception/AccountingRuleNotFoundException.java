package org.facturation.backend.exception;

public class AccountingRuleNotFoundException extends RuntimeException {
    public AccountingRuleNotFoundException(Long accountingRuleId) {
        super("Accounting rule " + accountingRuleId + " not found");
    }
}
