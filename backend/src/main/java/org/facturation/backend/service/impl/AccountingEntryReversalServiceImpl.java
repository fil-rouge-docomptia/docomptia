package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.exception.AccountingEntryNotFoundException;
import org.facturation.backend.exception.AccountingEntryReversalNotAllowedException;
import org.facturation.backend.mapper.AccountingEntryMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.service.AccountingEntryReversalService;
import org.facturation.backend.service.AuditLogService;
import org.facturation.backend.service.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AccountingEntryReversalServiceImpl implements AccountingEntryReversalService {

    private static final String REVERSAL_CREATED_ACTION = "ACCOUNTING_ENTRY_REVERSED";

    private final AccountingEntryRepository accountingEntryRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final AccountingEntryMapper accountingEntryMapper;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    public AccountingEntryReversalServiceImpl(
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository,
            AccountingEntryMapper accountingEntryMapper,
            AuditLogService auditLogService,
            CurrentUserService currentUserService
    ) {
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.accountingEntryMapper = accountingEntryMapper;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional
    public AccountingEntryResponse createReversal(Long accountingEntryId) {
        User user = currentUserService.getCurrentUser();
        AccountingEntry originalEntry = accountingEntryRepository
                .findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(
                        accountingEntryId,
                        user.getOrganization().getOrganizationId()
                )
                .orElseThrow(() -> new AccountingEntryNotFoundException(accountingEntryId));

        ensureReversible(originalEntry);
        List<AccountingEntryLine> originalLines = accountingEntryLineRepository
                .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(accountingEntryId);
        AccountingEntry reversal = createReversalEntry(originalEntry, user);
        List<AccountingEntryLine> reversalLines = originalLines.stream()
                .map(line -> createReversalLine(reversal, line))
                .toList();
        accountingEntryLineRepository.saveAll(reversalLines);
        auditLogService.save(createReversalAuditLog(originalEntry, reversal, user));
        return accountingEntryMapper.toResponse(reversal, reversalLines);
    }

    private AuditLog createReversalAuditLog(AccountingEntry originalEntry, AccountingEntry reversal, User user) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(user);
        auditLog.setEntityName(Invoice.class.getSimpleName());
        auditLog.setEntityId(originalEntry.getInvoice().getInvoiceId());
        auditLog.setAction(REVERSAL_CREATED_ACTION);
        auditLog.setOldValue("accountingEntryId=" + originalEntry.getAccountingEntryId());
        auditLog.setNewValue("accountingEntryId=" + reversal.getAccountingEntryId());
        auditLog.setCreatedAt(reversal.getCreatedAt());
        return auditLog;
    }

    private void ensureReversible(AccountingEntry accountingEntry) {
        if (accountingEntry.getReversedAccountingEntry() != null
                || !AccountingEntryStatusCode.GENERATED.getCode().equals(accountingEntry.getStatus())) {
            throw new AccountingEntryReversalNotAllowedException(
                    accountingEntry.getAccountingEntryId(),
                    "a reversal cannot itself be reversed"
            );
        }
        if (!InvoiceStatusCode.EXPORTEE.getCode().equals(accountingEntry.getInvoice().getInvoiceStatus().getCode())) {
            throw new AccountingEntryReversalNotAllowedException(accountingEntry.getAccountingEntryId());
        }
        if (accountingEntryRepository
                .findByReversedAccountingEntryAccountingEntryId(accountingEntry.getAccountingEntryId())
                .isPresent()) {
            throw new AccountingEntryReversalNotAllowedException(
                    accountingEntry.getAccountingEntryId(),
                    "a reversal already exists"
            );
        }
    }

    private AccountingEntry createReversalEntry(AccountingEntry originalEntry, User user) {
        LocalDateTime now = LocalDateTime.now();
        AccountingEntry reversal = new AccountingEntry();
        reversal.setInvoice(originalEntry.getInvoice());
        reversal.setReversedAccountingEntry(originalEntry);
        reversal.setCreatedByUser(user);
        reversal.setEntryNumber("EXT-" + originalEntry.getAccountingEntryId());
        reversal.setEntryDate(LocalDate.now());
        reversal.setLabel("Extourne - " + originalEntry.getLabel());
        reversal.setStatus(AccountingEntryStatusCode.REVERSAL.getCode());
        reversal.setCreatedAt(now);
        reversal.setUpdatedAt(now);
        return accountingEntryRepository.save(reversal);
    }

    private AccountingEntryLine createReversalLine(AccountingEntry reversal, AccountingEntryLine originalLine) {
        AccountingEntryLine reversalLine = new AccountingEntryLine();
        reversalLine.setAccountingEntry(reversal);
        reversalLine.setAccount(originalLine.getAccount());
        reversalLine.setSupplierAccount(originalLine.getSupplierAccount());
        reversalLine.setLineNumber(originalLine.getLineNumber());
        reversalLine.setLineLabel(originalLine.getLineLabel());
        reversalLine.setDebitAmount(originalLine.getCreditAmount());
        reversalLine.setCreditAmount(originalLine.getDebitAmount());
        reversalLine.setCreatedAt(LocalDateTime.now());
        return reversalLine;
    }
}
