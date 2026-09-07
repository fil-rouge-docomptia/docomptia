package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.exception.AccountingEntryNotFoundException;
import org.facturation.backend.exception.AccountingEntryReversalNotAllowedException;
import org.facturation.backend.mapper.AccountingEntryMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.service.AccountingEntryCorrectiveService;
import org.facturation.backend.service.AccountingEntryReversalService;
import org.facturation.backend.service.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AccountingEntryCorrectiveServiceImpl implements AccountingEntryCorrectiveService {

    private final AccountingEntryRepository accountingEntryRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final AccountingEntryReversalService accountingEntryReversalService;
    private final AccountingEntryMapper accountingEntryMapper;
    private final CurrentUserService currentUserService;

    public AccountingEntryCorrectiveServiceImpl(
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository,
            AccountingEntryReversalService accountingEntryReversalService,
            AccountingEntryMapper accountingEntryMapper,
            CurrentUserService currentUserService
    ) {
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.accountingEntryReversalService = accountingEntryReversalService;
        this.accountingEntryMapper = accountingEntryMapper;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional
    public AccountingEntryResponse createCorrectiveEntry(Long accountingEntryId) {
        User user = currentUserService.getCurrentUser();
        AccountingEntry originalEntry = accountingEntryRepository
                .findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(
                        accountingEntryId,
                        user.getOrganization().getOrganizationId()
                )
                .orElseThrow(() -> new AccountingEntryNotFoundException(accountingEntryId));
        ensureCorrectable(originalEntry);

        AccountingEntry reversal = accountingEntryRepository
                .findByReversedAccountingEntryAccountingEntryId(accountingEntryId)
                .orElseGet(() -> createAndFindReversal(accountingEntryId));
        return accountingEntryRepository
                .findByReversedAccountingEntryAccountingEntryId(reversal.getAccountingEntryId())
                .map(this::toResponse)
                .orElseGet(() -> createCorrectiveEntry(originalEntry, reversal, user));
    }

    private void ensureCorrectable(AccountingEntry accountingEntry) {
        if (accountingEntry.getReversedAccountingEntry() != null
                || !AccountingEntryStatusCode.GENERATED.getCode().equals(accountingEntry.getStatus())
                || !InvoiceStatusCode.EXPORTEE.getCode().equals(
                        accountingEntry.getInvoice().getInvoiceStatus().getCode()
                )) {
            throw new AccountingEntryReversalNotAllowedException(
                    accountingEntry.getAccountingEntryId(),
                    "only an exported original accounting entry can be corrected"
            );
        }
    }

    private AccountingEntry createAndFindReversal(Long accountingEntryId) {
        accountingEntryReversalService.createReversal(accountingEntryId);
        return accountingEntryRepository
                .findByReversedAccountingEntryAccountingEntryId(accountingEntryId)
                .orElseThrow();
    }

    private AccountingEntryResponse createCorrectiveEntry(
            AccountingEntry originalEntry,
            AccountingEntry reversal,
            User user
    ) {
        LocalDateTime now = LocalDateTime.now();
        AccountingEntry correctiveEntry = new AccountingEntry();
        correctiveEntry.setInvoice(originalEntry.getInvoice());
        correctiveEntry.setReversedAccountingEntry(reversal);
        correctiveEntry.setCreatedByUser(user);
        correctiveEntry.setEntryNumber("COR-" + originalEntry.getAccountingEntryId());
        correctiveEntry.setEntryDate(LocalDate.now());
        correctiveEntry.setLabel("Correction - " + originalEntry.getLabel());
        correctiveEntry.setStatus(AccountingEntryStatusCode.CORRECTIVE.getCode());
        correctiveEntry.setCreatedAt(now);
        correctiveEntry.setUpdatedAt(now);
        accountingEntryRepository.save(correctiveEntry);

        List<AccountingEntryLine> originalLines = accountingEntryLineRepository
                .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(originalEntry.getAccountingEntryId());
        List<AccountingEntryLine> correctiveLines = originalLines.stream()
                .map(line -> copyLine(correctiveEntry, line))
                .toList();
        accountingEntryLineRepository.saveAll(correctiveLines);
        return accountingEntryMapper.toResponse(correctiveEntry, correctiveLines);
    }

    private AccountingEntryResponse toResponse(AccountingEntry accountingEntry) {
        return accountingEntryMapper.toResponse(
                accountingEntry,
                accountingEntryLineRepository.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(
                        accountingEntry.getAccountingEntryId()
                )
        );
    }

    private AccountingEntryLine copyLine(AccountingEntry correctiveEntry, AccountingEntryLine originalLine) {
        AccountingEntryLine correctiveLine = new AccountingEntryLine();
        correctiveLine.setAccountingEntry(correctiveEntry);
        correctiveLine.setAccount(originalLine.getAccount());
        correctiveLine.setLineNumber(originalLine.getLineNumber());
        correctiveLine.setLineLabel(originalLine.getLineLabel());
        correctiveLine.setDebitAmount(originalLine.getDebitAmount());
        correctiveLine.setCreditAmount(originalLine.getCreditAmount());
        correctiveLine.setCreatedAt(LocalDateTime.now());
        return correctiveLine;
    }
}
