package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.AccountingRuleUpdateRequest;
import org.facturation.backend.dto.response.AccountingRuleResponse;
import org.facturation.backend.exception.AccountingRuleNotFoundException;
import org.facturation.backend.exception.InvalidAccountingRuleException;
import org.facturation.backend.mapper.AccountingRuleResponseMapper;
import org.facturation.backend.model.AccountingRule;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.repository.AccountingRuleRepository;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.service.AccountingRuleService;
import org.facturation.backend.service.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class AccountingRuleServiceImpl implements AccountingRuleService {
    private final AccountingRuleRepository accountingRuleRepository;
    private final ChartOfAccountRepository chartOfAccountRepository;
    private final CurrentUserService currentUserService;
    private final AccountingRuleResponseMapper accountingRuleResponseMapper;

    public AccountingRuleServiceImpl(AccountingRuleRepository accountingRuleRepository,
            ChartOfAccountRepository chartOfAccountRepository, CurrentUserService currentUserService,
            AccountingRuleResponseMapper accountingRuleResponseMapper) {
        this.accountingRuleRepository = accountingRuleRepository;
        this.chartOfAccountRepository = chartOfAccountRepository;
        this.currentUserService = currentUserService;
        this.accountingRuleResponseMapper = accountingRuleResponseMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccountingRuleResponse> findAllForCurrentOrganization() {
        return accountingRuleRepository
                .findByOrganizationOrganizationIdOrderByPriorityAscAccountingRuleIdAsc(findCurrentOrganizationId())
                .stream().map(accountingRuleResponseMapper::toResponse).toList();
    }

    @Override
    @Transactional
    public AccountingRuleResponse update(Long accountingRuleId, AccountingRuleUpdateRequest request) {
        Long organizationId = findCurrentOrganizationId();
        AccountingRule rule = accountingRuleRepository
                .findByAccountingRuleIdAndOrganizationOrganizationId(accountingRuleId, organizationId)
                .orElseThrow(() -> new AccountingRuleNotFoundException(accountingRuleId));
        boolean changed = false;
        changed |= updateAccount(request.getExpenseAccountId(), rule.getExpenseAccount(), rule::setExpenseAccount,
                organizationId, "expenseAccountId");
        changed |= updateAccount(request.getVatAccountId(), rule.getVatAccount(), rule::setVatAccount,
                organizationId, "vatAccountId");
        changed |= updateAccount(request.getSupplierAccountId(), rule.getSupplierAccount(), rule::setSupplierAccount,
                organizationId, "supplierAccountId");
        if (!changed) { throw new InvalidAccountingRuleException("At least one changed account is required"); }
        rule.setUpdatedAt(LocalDateTime.now());
        return accountingRuleResponseMapper.toResponse(accountingRuleRepository.save(rule));
    }

    private boolean updateAccount(Long requestedAccountId, ChartOfAccount currentAccount,
            java.util.function.Consumer<ChartOfAccount> setter, Long organizationId, String fieldName) {
        if (requestedAccountId == null) { return false; }
        ChartOfAccount account = chartOfAccountRepository
                .findByAccountIdAndOrganizationOrganizationIdAndIsActiveTrue(requestedAccountId, organizationId)
                .orElseThrow(() -> new InvalidAccountingRuleException(
                        fieldName + " must reference an active account of the organization"));
        if (currentAccount != null && Objects.equals(currentAccount.getAccountId(), requestedAccountId)) { return false; }
        setter.accept(account);
        return true;
    }

    private Long findCurrentOrganizationId() {
        return currentUserService.getCurrentUser()
                .getOrganization().getOrganizationId();
    }
}
