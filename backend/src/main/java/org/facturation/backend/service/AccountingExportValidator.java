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
import org.facturation.backend.model.SupplierAccount;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class AccountingExportValidator {

    private static final int AMOUNT_SCALE = 2;
    private static final Pattern FEC_ACCOUNT_NUMBER = Pattern.compile("[0-9]{3}[A-Za-z0-9]*");

    private final AccountingEntryRepository accountingEntryRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final AccountingEntryMapper accountingEntryMapper;
    private final FrenchLegalIdentifierValidator frenchLegalIdentifierValidator;
    private final InvoiceAmountConsistencyService invoiceAmountConsistencyService;

    public AccountingExportValidator(
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository,
            AccountingEntryMapper accountingEntryMapper,
            FrenchLegalIdentifierValidator frenchLegalIdentifierValidator,
            InvoiceAmountConsistencyService invoiceAmountConsistencyService
    ) {
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.accountingEntryMapper = accountingEntryMapper;
        this.frenchLegalIdentifierValidator = frenchLegalIdentifierValidator;
        this.invoiceAmountConsistencyService = invoiceAmountConsistencyService;
    }

    public List<ValidatedEntry> validate(List<Invoice> invoices) {
        return validate(invoices, false);
    }

    public List<ValidatedEntry> validateForFec(List<Invoice> invoices) {
        return validate(invoices, true);
    }

    private List<ValidatedEntry> validate(List<Invoice> invoices, boolean fec) {
        List<ValidatedEntry> validatedEntries = new ArrayList<>();
        List<InvoiceExportErrorResponse> invoiceErrors = new ArrayList<>();

        for (Invoice invoice : invoices) {
            List<AccountingExportControlErrorResponse> errors = new ArrayList<>();
            validateStatus(invoice, errors);
            validateVat(invoice, errors);
            if (fec) {
                validateFecInvoice(invoice, errors);
            }

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
                if (fec) {
                    validateFecEntry(entry, lines, errors);
                }
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

    private void validateFecInvoice(Invoice invoice, List<AccountingExportControlErrorResponse> errors) {
        if (!hasText(invoice.getInvoiceNumber())) {
            addError(errors, "FEC_PIECE_REFERENCE_MISSING", "The invoice number is required for FEC export");
        }
        if (invoice.getInvoiceDate() == null) {
            addError(errors, "FEC_PIECE_DATE_MISSING", "The invoice date is required for FEC export");
        }
        String siret = invoice.getOrganization().getSiret();
        if (siret == null || !frenchLegalIdentifierValidator.isValidSiret(siret)) {
            addError(errors, "FEC_ORGANIZATION_SIRET_INVALID", "The organization must have a valid SIRET");
        }
        validateFecText(invoice.getInvoiceNumber(), "invoice number", errors);
    }

    private void validateFecEntry(
            AccountingEntry entry,
            List<AccountingEntryLine> lines,
            List<AccountingExportControlErrorResponse> errors
    ) {
        if (entry.getEntryDate() == null) {
            addError(errors, "FEC_ENTRY_DATE_MISSING", "The accounting entry date is required for FEC export");
        }
        if (!hasText(entry.getLabel())) {
            addError(errors, "FEC_ENTRY_LABEL_MISSING", "The accounting entry label is required for FEC export");
        }
        validateFecText(entry.getLabel(), "accounting entry label", errors);

        for (AccountingEntryLine line : lines) {
            ChartOfAccount account = line.getAccount();
            if (account != null && hasText(account.getAccountNumber())
                    && !FEC_ACCOUNT_NUMBER.matcher(account.getAccountNumber()).matches()) {
                addError(
                        errors,
                        "FEC_ACCOUNT_NUMBER_INVALID",
                        "Account " + account.getAccountNumber() + " must start with three digits"
                );
            }
            if (account != null && !hasText(account.getAccountLabel())) {
                addError(errors, "FEC_ACCOUNT_LABEL_MISSING", "Accounting line " + line.getLineNumber()
                        + " has no account label");
            }
            validateFecText(account == null ? null : account.getAccountLabel(), "account label", errors);
            SupplierAccount supplierAccount = line.getSupplierAccount();
            if (supplierAccount != null) {
                validateFecText(supplierAccount.getCode(), "supplier account code", errors);
                validateFecText(supplierAccount.getLabel(), "supplier account label", errors);
            }
            validateFecAmounts(line, errors);
        }
    }

    private void validateFecAmounts(
            AccountingEntryLine line,
            List<AccountingExportControlErrorResponse> errors
    ) {
        BigDecimal debit = normalize(line.getDebitAmount());
        BigDecimal credit = normalize(line.getCreditAmount());
        if (debit == null || credit == null || debit.signum() < 0 || credit.signum() < 0
                || (debit.signum() == 0 && credit.signum() == 0)
                || (debit.signum() > 0 && credit.signum() > 0)) {
            addError(errors, "FEC_AMOUNT_INVALID", "Accounting line " + line.getLineNumber()
                    + " must have one non-negative debit or credit amount");
        }
    }

    private void validateFecText(
            String value,
            String fieldName,
            List<AccountingExportControlErrorResponse> errors
    ) {
        if (value != null && (value.indexOf('\t') >= 0 || value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0)) {
            addError(errors, "FEC_TEXT_INVALID", "The " + fieldName + " contains a forbidden control character");
        }
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
                || totalHt.signum() < 0 || totalTva.signum() < 0 || totalTtc.signum() <= 0) {
            addError(errors, "VAT_INCONSISTENT", "HT, TVA and TTC must all be present and valid");
        } else if (!invoiceAmountConsistencyService.isConsistent(invoice)) {
            BigDecimal expectedTtc = invoiceAmountConsistencyService.expectedTtc(invoice);
            addError(errors, "VAT_INCONSISTENT", "HT + TVA = " + expectedTtc + ", but TTC = " + totalTtc
                    + " (accepted tolerance " + InvoiceAmountConsistencyService.ROUNDING_TOLERANCE + ")");
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
            validateSupplierAccount(invoice, line, errors);
        }
    }

    private void validateSupplierAccount(
            Invoice invoice,
            AccountingEntryLine line,
            List<AccountingExportControlErrorResponse> errors
    ) {
        SupplierAccount supplierAccount = line.getSupplierAccount();
        if (supplierAccount == null) {
            return;
        }
        if (!supplierAccount.isActive()) {
            addError(errors, "SUPPLIER_ACCOUNT_INACTIVE",
                    "Supplier account " + supplierAccount.getCode() + " is inactive");
        } else if (!hasText(supplierAccount.getCode()) || !hasText(supplierAccount.getLabel())) {
            addError(errors, "SUPPLIER_ACCOUNT_MISSING",
                    "Accounting line " + line.getLineNumber() + " has an incomplete supplier account");
        } else if (!invoice.getOrganization().getOrganizationId()
                .equals(supplierAccount.getOrganization().getOrganizationId())) {
            addError(errors, "SUPPLIER_ACCOUNT_OUTSIDE_ORGANIZATION",
                    "Supplier account " + supplierAccount.getCode() + " does not belong to the invoice organization");
        } else if (invoice.getSupplier() == null || supplierAccount.getSupplier() == null
                || !invoice.getSupplier().getSupplierId().equals(supplierAccount.getSupplier().getSupplierId())) {
            addError(errors, "SUPPLIER_ACCOUNT_MISMATCH",
                    "Supplier account " + supplierAccount.getCode() + " does not belong to the invoice supplier");
        } else if (line.getAccount() == null || !line.getAccount().getAccountId()
                .equals(supplierAccount.getCollectiveAccount().getAccountId())) {
            addError(errors, "SUPPLIER_COLLECTIVE_ACCOUNT_MISMATCH",
                    "Supplier account " + supplierAccount.getCode() + " does not match the accounting line account");
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
