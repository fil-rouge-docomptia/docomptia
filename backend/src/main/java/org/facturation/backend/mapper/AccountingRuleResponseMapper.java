package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.AccountingRuleAccountResponse;
import org.facturation.backend.dto.response.AccountingRuleResponse;
import org.facturation.backend.model.AccountingRule;
import org.facturation.backend.model.ChartOfAccount;
import org.springframework.stereotype.Component;

@Component
public class AccountingRuleResponseMapper {
    public AccountingRuleResponse toResponse(AccountingRule rule) {
        AccountingRuleResponse response = new AccountingRuleResponse();
        response.setAccountingRuleId(rule.getAccountingRuleId());
        response.setRuleName(rule.getRuleName());
        response.setExpenseAccount(toAccountResponse(rule.getExpenseAccount()));
        response.setVatAccount(toAccountResponse(rule.getVatAccount()));
        response.setSupplierAccount(toAccountResponse(rule.getSupplierAccount()));
        response.setActive(rule.isActive());
        response.setConfigurationComplete(isActive(rule.getExpenseAccount())
                && isActive(rule.getVatAccount()) && isActive(rule.getSupplierAccount()));
        return response;
    }

    private AccountingRuleAccountResponse toAccountResponse(ChartOfAccount account) {
        if (account == null) { return null; }
        AccountingRuleAccountResponse response = new AccountingRuleAccountResponse();
        response.setAccountId(account.getAccountId());
        response.setAccountNumber(account.getAccountNumber());
        response.setAccountLabel(account.getAccountLabel());
        response.setActive(account.isActive());
        return response;
    }

    private boolean isActive(ChartOfAccount account) { return account != null && account.isActive(); }
}
