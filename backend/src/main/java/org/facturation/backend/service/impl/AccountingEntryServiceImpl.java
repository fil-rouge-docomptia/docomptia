package org.facturation.backend.service.impl;

import jakarta.transaction.Transactional;
import org.facturation.backend.model.AccountingRule;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AccountingRuleRepository;
import org.facturation.backend.service.AccountingEntryService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class AccountingEntryServiceImpl implements AccountingEntryService {

    private static final int AMOUNT_SCALE = 2;
    private static final BigDecimal ZERO_AMOUNT = BigDecimal.ZERO.setScale(AMOUNT_SCALE);

    private final AccountingEntryRepository accountingEntryRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final AccountingRuleRepository accountingRuleRepository;

    public AccountingEntryServiceImpl(
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository,
            AccountingRuleRepository accountingRuleRepository
    ) {
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.accountingRuleRepository = accountingRuleRepository;
    }

    @Override
    public List<AccountingEntry> findAll() {
        return accountingEntryRepository.findAll();
    }

    @Override
    public Optional<AccountingEntry> findById(Long id) {
        return accountingEntryRepository.findById(id);
    }

    @Override
    public AccountingEntry save(AccountingEntry accountingEntry) {
        return accountingEntryRepository.save(accountingEntry);
    }

    @Override
    @Transactional
    public AccountingEntry generateFromInvoice(Invoice invoice, User user) {
        return accountingEntryRepository.findByInvoiceInvoiceId(invoice.getInvoiceId())
                .orElseGet(() -> createAccountingEntry(invoice, user));
    }

    @Override
    public Optional<AccountingEntry> findByInvoiceId(Long invoiceId) {
        return accountingEntryRepository.findByInvoiceInvoiceId(invoiceId);
    }

    @Override
    public List<AccountingEntryLine> findLines(AccountingEntry accountingEntry) {
        return accountingEntryLineRepository.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(
                accountingEntry.getAccountingEntryId()
        );
    }

    private AccountingEntry createAccountingEntry(Invoice invoice, User user) {
        AccountingRule accountingRule = findAccountingRule(invoice);
        BigDecimal totalHt = normalizeAmount(invoice.getTotalHt());
        BigDecimal totalTva = normalizeAmount(invoice.getTotalTva());
        BigDecimal totalTtc = normalizeAmount(invoice.getTotalTtc());

        validateInvoiceAmounts(totalHt, totalTva, totalTtc);
        validateActiveAccounts(accountingRule);

        AccountingEntry accountingEntry = new AccountingEntry();
        accountingEntry.setInvoice(invoice);
        accountingEntry.setCreatedByUser(user);
        accountingEntry.setEntryNumber("EC-" + invoice.getInvoiceId());
        accountingEntry.setEntryDate(invoice.getInvoiceDate() == null ? LocalDate.now() : invoice.getInvoiceDate());
        accountingEntry.setLabel(buildAccountingEntryLabel(invoice));
        accountingEntry.setStatus(AccountingEntryStatusCode.GENERATED.getCode());
        accountingEntry.setCreatedAt(LocalDateTime.now());
        accountingEntry.setUpdatedAt(LocalDateTime.now());

        AccountingEntry savedAccountingEntry = accountingEntryRepository.save(accountingEntry);
        saveLines(savedAccountingEntry, invoice, accountingRule, totalHt, totalTva, totalTtc);
        return savedAccountingEntry;
    }

    private AccountingRule findAccountingRule(Invoice invoice) {
        return accountingRuleRepository
                .findByOrganizationOrganizationIdAndActiveTrueOrderByPriorityAscAccountingRuleIdAsc(
                        invoice.getOrganization().getOrganizationId()
                )
                .stream()
                .filter(rule -> matchesInvoice(rule, invoice))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No accounting rule found for invoice"));
    }

    private boolean matchesInvoice(AccountingRule rule, Invoice invoice) {
        return matchesSupplier(rule, invoice) && matchesKeyword(rule, invoice);
    }

    private boolean matchesSupplier(AccountingRule rule, Invoice invoice) {
        return rule.getSupplier() == null || rule.getSupplier().getSupplierId().equals(invoice.getSupplier().getSupplierId());
    }

    private boolean matchesKeyword(AccountingRule rule, Invoice invoice) {
        if (!hasText(rule.getKeyword())) {
            return true;
        }
        return searchableInvoiceText(invoice).contains(rule.getKeyword().toLowerCase(Locale.ROOT));
    }

    private String searchableInvoiceText(Invoice invoice) {
        return String.join(
                " ",
                nullSafe(invoice.getSupplier().getName()),
                nullSafe(invoice.getSupplier().getLegalName()),
                nullSafe(invoice.getDescription()),
                nullSafe(invoice.getInvoiceNumber())
        ).toLowerCase(Locale.ROOT);
    }

    private void saveLines(
            AccountingEntry accountingEntry,
            Invoice invoice,
            AccountingRule accountingRule,
            BigDecimal totalHt,
            BigDecimal totalTva,
            BigDecimal totalTtc
    ) {
        int lineNumber = 1;
        if (isPositive(totalHt)) {
            saveLine(
                    accountingEntry,
                    lineNumber++,
                    accountingRule.getExpenseAccount(),
                    buildLineLabel(invoice),
                    totalHt,
                    ZERO_AMOUNT
            );
        }
        if (isPositive(totalTva)) {
            saveLine(
                    accountingEntry,
                    lineNumber++,
                    accountingRule.getVatAccount(),
                    buildLineLabel(invoice),
                    totalTva,
                    ZERO_AMOUNT
            );
        }
        saveLine(
                accountingEntry,
                lineNumber,
                accountingRule.getSupplierAccount(),
                buildLineLabel(invoice),
                ZERO_AMOUNT,
                totalTtc
        );
    }

    private void saveLine(
            AccountingEntry accountingEntry,
            int lineNumber,
            ChartOfAccount account,
            String lineLabel,
            BigDecimal debitAmount,
            BigDecimal creditAmount
    ) {
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(accountingEntry);
        line.setAccount(account);
        line.setLineNumber(lineNumber);
        line.setLineLabel(lineLabel);
        line.setDebitAmount(debitAmount);
        line.setCreditAmount(creditAmount);
        line.setCreatedAt(LocalDateTime.now());
        accountingEntryLineRepository.save(line);
    }

    private void validateInvoiceAmounts(BigDecimal totalHt, BigDecimal totalTva, BigDecimal totalTtc) {
        if (!isPositive(totalTtc)) {
            throw new IllegalStateException("Cannot generate accounting entry without a positive total TTC");
        }
        if (totalHt.add(totalTva).compareTo(totalTtc) != 0) {
            throw new IllegalStateException("Cannot generate a balanced accounting entry from invoice amounts");
        }
    }

    private void validateActiveAccounts(AccountingRule accountingRule) {
        validateActiveAccount(accountingRule.getExpenseAccount());
        validateActiveAccount(accountingRule.getVatAccount());
        validateActiveAccount(accountingRule.getSupplierAccount());
    }

    private void validateActiveAccount(ChartOfAccount account) {
        if (!account.isActive()) {
            throw new IllegalStateException("Chart of account " + account.getAccountNumber() + " is inactive");
        }
    }

    private String buildAccountingEntryLabel(Invoice invoice) {
        return "Facture " + invoice.getInvoiceNumber() + " - " + invoice.getSupplier().getName();
    }

    private String buildLineLabel(Invoice invoice) {
        return buildAccountingEntryLabel(invoice);
    }

    private boolean isPositive(BigDecimal amount) {
        return amount != null && amount.compareTo(BigDecimal.ZERO) > 0;
    }

    private BigDecimal normalizeAmount(BigDecimal amount) {
        if (amount == null) {
            return ZERO_AMOUNT;
        }
        return amount.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }
}
