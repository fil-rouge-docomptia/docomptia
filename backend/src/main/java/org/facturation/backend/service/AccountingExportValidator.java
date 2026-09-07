package org.facturation.backend.service;

import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.dto.response.AccountingExportControlErrorResponse;
import org.facturation.backend.dto.response.InvoiceExportErrorResponse;
import org.facturation.backend.exception.AccountingExportValidationException;
import org.facturation.backend.mapper.AccountingEntryMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
public class AccountingExportValidator {

    private static final int AMOUNT_SCALE = 2;

    private final AccountingEntryRepository accountingEntryRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final AccountingEntryMapper accountingEntryMapper;

    public AccountingExportValidator(
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository,
            AccountingEntryMapper accountingEntryMapper
    ) {
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.accountingEntryMapper = accountingEntryMapper;
    }

    public List<ValidatedEntry> validate(List<Invoice> invoices) {
        List<ValidatedEntry> validatedEntries = new ArrayList<>();
        List<InvoiceExportErrorResponse> invoiceErrors = new ArrayList<>();

        for (Invoice invoice : invoices) {
            List<AccountingExportControlErrorResponse> errors = new ArrayList<>();
            validateStatus(invoice, errors);
            validateVat(invoice, errors);

            AccountingEntry entry = accountingEntryRepository
                    .findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(invoice.getInvoiceId())
                    .orElse(null);
            if (entry == null) {
                addError(errors, "ACCOUNTING_ENTRY_MISSING", "The invoice has no accounting entry");
            } else {
                List<AccountingEntryLine> lines = accountingEntryLineRepository
                        .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entry.getAccountingEntryId());
                validateAccounts(invoice, lines, errors);
                validateBalance(entry, lines, errors);
                validatedEntries.add(new ValidatedEntry(entry, lines));
            }

            if (!errors.isEmpty()) {
                invoiceErrors.add(new InvoiceExportErrorResponse(
                        invoice.getInvoiceId(),
                        invoice.getInvoiceNumber(),
                        List.copyOf(errors)
                ));
            }
        }

        if (!invoiceErrors.isEmpty()) {
            throw new AccountingExportValidationException(invoiceErrors);
        }
        return validatedEntries;
    }

    private void validateStatus(Invoice invoice, List<AccountingExportControlErrorResponse> errors) {
        if (!InvoiceStatusCode.EXPORTABLE.getCode().equals(invoice.getInvoiceStatus().getCode())) {
            addError(errors, "INVOICE_NOT_EXPORTABLE", "The invoice status must be EXPORTABLE");
        }
    }

    private void validateVat(Invoice invoice, List<AccountingExportControlErrorResponse> errors) {
        BigDecimal totalHt = normalize(invoice.getTotalHt());
        BigDecimal totalTva = normalize(invoice.getTotalTva());
        BigDecimal totalTtc = normalize(invoice.getTotalTtc());
        if (totalHt == null || totalTva == null || totalTtc == null
                || totalHt.signum() < 0 || totalTva.signum() < 0 || totalTtc.signum() <= 0
                || totalHt.add(totalTva).compareTo(totalTtc) != 0) {
            addError(errors, "VAT_INCONSISTENT", "The invoice VAT totals are inconsistent");
        }
    }

    private void validateAccounts(
            Invoice invoice,
            List<AccountingEntryLine> lines,
            List<AccountingExportControlErrorResponse> errors
    ) {
        if (lines.isEmpty()) {
            addError(errors, "ACCOUNTING_LINES_MISSING", "The accounting entry has no lines");
            return;
        }
        for (AccountingEntryLine line : lines) {
            ChartOfAccount account = line.getAccount();
            if (account == null || !hasText(account.getAccountNumber())) {
                addError(errors, "ACCOUNT_MISSING", "Accounting line " + line.getLineNumber() + " has no account");
            } else if (!account.isActive()) {
                addError(errors, "ACCOUNT_INACTIVE", "Account " + account.getAccountNumber() + " is inactive");
            } else if (!invoice.getOrganization().getOrganizationId()
                    .equals(account.getOrganization().getOrganizationId())) {
                addError(
                        errors,
                        "ACCOUNT_OUTSIDE_ORGANIZATION",
                        "Account " + account.getAccountNumber() + " does not belong to the invoice organization"
                );
            }
        }
    }

    private void validateBalance(
            AccountingEntry entry,
            List<AccountingEntryLine> lines,
            List<AccountingExportControlErrorResponse> errors
    ) {
        AccountingEntryResponse response = accountingEntryMapper.toResponse(entry, lines);
        if (!response.isBalanced()) {
            addError(
                    errors,
                    "ACCOUNTING_ENTRY_UNBALANCED",
                    "The accounting entry is unbalanced: debit=" + response.getTotalDebit()
                            + ", credit=" + response.getTotalCredit()
                );
        }
    }

    private BigDecimal normalize(BigDecimal amount) {
        return amount == null ? null : amount.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void addError(
            List<AccountingExportControlErrorResponse> errors,
            String code,
            String message
    ) {
        errors.add(new AccountingExportControlErrorResponse(code, message));
    }

    public record ValidatedEntry(AccountingEntry entry, List<AccountingEntryLine> lines) {
    }
}
