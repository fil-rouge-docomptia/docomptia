package org.facturation.backend.service.impl;

import jakarta.transaction.Transactional;
import org.facturation.backend.exception.AccountingEntryPrerequisitesException;
import org.facturation.backend.model.AccountingRule;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.SupplierAccount;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AccountingRuleRepository;
import org.facturation.backend.repository.SupplierAccountRepository;
import org.facturation.backend.service.AccountingEntryService;
import org.facturation.backend.service.InvoiceAmountConsistencyService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
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
    private final SupplierAccountRepository supplierAccountRepository;
    private final InvoiceAmountConsistencyService invoiceAmountConsistencyService;

    public AccountingEntryServiceImpl(
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository,
            AccountingRuleRepository accountingRuleRepository,
            SupplierAccountRepository supplierAccountRepository,
            InvoiceAmountConsistencyService invoiceAmountConsistencyService
    ) {
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.accountingRuleRepository = accountingRuleRepository;
        this.supplierAccountRepository = supplierAccountRepository;
        this.invoiceAmountConsistencyService = invoiceAmountConsistencyService;
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
        return accountingEntryRepository.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(invoice.getInvoiceId())
                .orElseGet(() -> createAccountingEntry(invoice, user));
    }

    @Override
    public Optional<AccountingEntry> findByInvoiceId(Long invoiceId) {
        return accountingEntryRepository.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(invoiceId);
    }

    @Override
    public List<AccountingEntry> findAllByInvoiceId(Long invoiceId) {
        return accountingEntryRepository.findByInvoiceInvoiceIdOrderByCreatedAtAscAccountingEntryIdAsc(invoiceId);
    }

    @Override
    public List<AccountingEntryLine> findLines(AccountingEntry accountingEntry) {
        return accountingEntryLineRepository.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(
                accountingEntry.getAccountingEntryId()
        );
    }

    private AccountingEntry createAccountingEntry(Invoice invoice, User user) {
        AccountingEntryPrerequisites prerequisites = validatePrerequisites(invoice);
        AccountingRule accountingRule = prerequisites.accountingRule();
        BigDecimal totalHt = prerequisites.totalHt();
        BigDecimal totalTva = prerequisites.totalTva();
        BigDecimal totalTtc = prerequisites.totalTtc();
        SupplierAccount supplierAccount = prerequisites.supplierAccount();

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
        saveLines(savedAccountingEntry, invoice, accountingRule, supplierAccount, totalHt, totalTva, totalTtc);
        return savedAccountingEntry;
    }

    private Optional<AccountingRule> findAccountingRule(Invoice invoice) {
        return accountingRuleRepository
                .findByOrganizationOrganizationIdAndActiveTrueOrderByPriorityAscAccountingRuleIdAsc(
                        invoice.getOrganization().getOrganizationId()
                )
                .stream()
                .filter(rule -> matchesInvoice(rule, invoice))
                .findFirst();
    }

    private boolean matchesInvoice(AccountingRule rule, Invoice invoice) {
        return matchesSupplier(rule, invoice) && matchesKeyword(rule, invoice);
    }

    private boolean matchesSupplier(AccountingRule rule, Invoice invoice) {
        return rule.getSupplier() == null
                || invoice.getSupplier() != null
                && rule.getSupplier().getSupplierId().equals(invoice.getSupplier().getSupplierId());
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
            SupplierAccount supplierAccount,
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
                supplierAccount == null ? accountingRule.getSupplierAccount() : supplierAccount.getCollectiveAccount(),
                supplierAccount,
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
        saveLine(accountingEntry, lineNumber, account, null, lineLabel, debitAmount, creditAmount);
    }

    private void saveLine(
            AccountingEntry accountingEntry,
            int lineNumber,
            ChartOfAccount account,
            SupplierAccount supplierAccount,
            String lineLabel,
            BigDecimal debitAmount,
            BigDecimal creditAmount
    ) {
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(accountingEntry);
        line.setAccount(account);
        line.setSupplierAccount(supplierAccount);
        line.setLineNumber(lineNumber);
        line.setLineLabel(lineLabel);
        line.setDebitAmount(debitAmount);
        line.setCreditAmount(creditAmount);
        line.setCreatedAt(LocalDateTime.now());
        accountingEntryLineRepository.save(line);
    }

    private Optional<SupplierAccount> findActiveSupplierAccount(Invoice invoice) {
        if (invoice.getSupplier() == null) {
            return Optional.empty();
        }
        return supplierAccountRepository.findBySupplierSupplierIdAndOrganizationOrganizationIdAndActiveTrue(
                invoice.getSupplier().getSupplierId(),
                invoice.getOrganization().getOrganizationId()
        );
    }

    private AccountingEntryPrerequisites validatePrerequisites(Invoice invoice) {
        invoiceAmountConsistencyService.recalculateTtcWhenMissingOrWithinTolerance(invoice);
        invoiceAmountConsistencyService.ensureConsistent(invoice);
        List<String> missingPrerequisites = new ArrayList<>();
        BigDecimal totalHt = validateAmount(invoice.getTotalHt(), "totalHt", false, missingPrerequisites);
        BigDecimal totalTva = validateAmount(invoice.getTotalTva(), "totalTva", false, missingPrerequisites);
        BigDecimal totalTtc = validateAmount(invoice.getTotalTtc(), "totalTtc", true, missingPrerequisites);

        if (invoice.getSupplier() == null) {
            missingPrerequisites.add("supplier");
        }
        SupplierAccount supplierAccount = findActiveSupplierAccount(invoice).orElse(null);

        Optional<AccountingRule> accountingRule = findAccountingRule(invoice);
        if (accountingRule.isEmpty()) {
            missingPrerequisites.add("accountingRule");
        } else {
            validateAccount(accountingRule.get().getExpenseAccount(), "expenseAccount", invoice, missingPrerequisites);
            validateAccount(accountingRule.get().getVatAccount(), "vatAccount", invoice, missingPrerequisites);
            validateAccount(
                    supplierAccount == null
                            ? accountingRule.get().getSupplierAccount()
                            : supplierAccount.getCollectiveAccount(),
                    "supplierAccount",
                    invoice,
                    missingPrerequisites
            );
        }

        if (!missingPrerequisites.isEmpty()) {
            throw new AccountingEntryPrerequisitesException(invoice.getInvoiceId(), missingPrerequisites);
        }
        return new AccountingEntryPrerequisites(
                accountingRule.orElseThrow(),
                supplierAccount,
                totalHt,
                totalTva,
                totalTtc
        );
    }

    private BigDecimal validateAmount(
            BigDecimal amount,
            String prerequisite,
            boolean mustBePositive,
            List<String> missingPrerequisites
    ) {
        if (amount == null) {
            missingPrerequisites.add(prerequisite);
            return null;
        }
        BigDecimal normalizedAmount = normalizeAmount(amount);
        boolean invalid = mustBePositive
                ? normalizedAmount.compareTo(BigDecimal.ZERO) <= 0
                : normalizedAmount.compareTo(BigDecimal.ZERO) < 0;
        if (invalid) {
            missingPrerequisites.add(prerequisite);
        }
        return normalizedAmount;
    }

    private void validateAccount(
            ChartOfAccount account,
            String prerequisite,
            Invoice invoice,
            List<String> missingPrerequisites
    ) {
        if (account == null || !account.isActive()
                || !account.getOrganization().getOrganizationId().equals(invoice.getOrganization().getOrganizationId())) {
            missingPrerequisites.add(prerequisite);
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

    private record AccountingEntryPrerequisites(
            AccountingRule accountingRule,
            SupplierAccount supplierAccount,
            BigDecimal totalHt,
            BigDecimal totalTva,
            BigDecimal totalTtc
    ) {
    }
}
