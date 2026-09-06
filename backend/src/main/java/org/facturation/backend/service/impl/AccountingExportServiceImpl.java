package org.facturation.backend.service.impl;

import jakarta.transaction.Transactional;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.exception.UnbalancedAccountingEntryException;
import org.facturation.backend.mapper.AccountingEntryMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.service.AccountingExportService;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class AccountingExportServiceImpl implements AccountingExportService {

    private static final int AMOUNT_SCALE = 2;
    private static final String HEADER =
            "entryNumber,entryDate,invoiceNumber,invoiceDate,supplierName,accountNumber,"
                    + "accountLabel,lineLabel,debitAmount,creditAmount,currencyCode";

    private final AccountingEntryRepository accountingEntryRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final AccountingEntryMapper accountingEntryMapper;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserService currentUserService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;

    public AccountingExportServiceImpl(
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository,
            AccountingEntryMapper accountingEntryMapper,
            AuditLogRepository auditLogRepository,
            CurrentUserService currentUserService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService
    ) {
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.accountingEntryMapper = accountingEntryMapper;
        this.auditLogRepository = auditLogRepository;
        this.currentUserService = currentUserService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
    }

    @Override
    @Transactional
    public AccountingCsvExport exportCsv(LocalDate startDate, LocalDate endDate) {
        validatePeriod(startDate, endDate);
        User user = currentUserService.getCurrentUser();
        Long organizationId = user.getOrganization().getOrganizationId();
        List<AccountingEntry> entries = accountingEntryRepository.findExportableEntriesForCsvExport(
                organizationId,
                startDate != null,
                startDate,
                endDate != null,
                endDate
        );
        if (entries.isEmpty()) {
            throw new IllegalArgumentException("No exportable invoices found for accounting CSV export");
        }

        List<ExportedEntry> exportedEntries = new ArrayList<>();
        for (AccountingEntry entry : entries) {
            List<AccountingEntryLine> lines = accountingEntryLineRepository
                    .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entry.getAccountingEntryId());
            AccountingEntryResponse response = accountingEntryMapper.toResponse(entry, lines);
            if (!response.isBalanced()) {
                throw new UnbalancedAccountingEntryException(response);
            }
            exportedEntries.add(new ExportedEntry(entry, lines));
        }

        String filename = buildFilename(startDate, endDate);
        String csv = buildCsv(exportedEntries);
        markInvoicesExported(exportedEntries, user);
        recordExport(exportedEntries, user, filename);
        return new AccountingCsvExport(filename, csv.getBytes(StandardCharsets.UTF_8));
    }

    private void validatePeriod(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate must be before or equal to endDate");
        }
    }

    private String buildCsv(List<ExportedEntry> exportedEntries) {
        StringBuilder csv = new StringBuilder(HEADER).append('\n');
        for (ExportedEntry exportedEntry : exportedEntries) {
            AccountingEntry entry = exportedEntry.entry();
            Invoice invoice = entry.getInvoice();
            for (AccountingEntryLine line : exportedEntry.lines()) {
                appendRow(csv, entry, invoice, line);
            }
        }
        return csv.toString();
    }

    private void appendRow(StringBuilder csv, AccountingEntry entry, Invoice invoice, AccountingEntryLine line) {
        csv.append(csvValue(entry.getEntryNumber())).append(',')
                .append(csvValue(formatDate(entry.getEntryDate()))).append(',')
                .append(csvValue(invoice.getInvoiceNumber())).append(',')
                .append(csvValue(formatDate(invoice.getInvoiceDate()))).append(',')
                .append(csvValue(invoice.getSupplier() == null ? null : invoice.getSupplier().getName())).append(',')
                .append(csvValue(line.getAccount().getAccountNumber())).append(',')
                .append(csvValue(line.getAccount().getAccountLabel())).append(',')
                .append(csvValue(line.getLineLabel())).append(',')
                .append(csvValue(formatAmount(line.getDebitAmount()))).append(',')
                .append(csvValue(formatAmount(line.getCreditAmount()))).append(',')
                .append(csvValue(invoice.getCurrencyCode()))
                .append('\n');
    }

    private void markInvoicesExported(List<ExportedEntry> exportedEntries, User user) {
        for (ExportedEntry exportedEntry : exportedEntries) {
            invoiceStatusWorkflowService.transitionTo(
                    exportedEntry.entry().getInvoice(),
                    InvoiceStatusCode.EXPORTEE,
                    user,
                    "Accounting CSV export completed"
            );
        }
    }

    private void recordExport(List<ExportedEntry> exportedEntries, User user, String filename) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(user);
        auditLog.setEntityName("AccountingCsvExport");
        auditLog.setEntityId(user.getOrganization().getOrganizationId());
        auditLog.setAction("CSV_EXPORT");
        auditLog.setOldValue("invoiceIds=" + exportedEntries.stream()
                .map(exportedEntry -> exportedEntry.entry().getInvoice().getInvoiceId().toString())
                .toList());
        auditLog.setNewValue("filename=" + filename + ", entryCount=" + exportedEntries.size());
        auditLog.setCreatedAt(LocalDateTime.now());
        auditLogRepository.save(auditLog);
    }

    private String buildFilename(LocalDate startDate, LocalDate endDate) {
        String period = "all";
        if (startDate != null || endDate != null) {
            period = (startDate == null ? "start" : startDate.toString())
                    + "_"
                    + (endDate == null ? "end" : endDate.toString());
        }
        return "accounting-export-" + period + "-" + LocalDate.now() + ".csv";
    }

    private String csvValue(String value) {
        if (value == null) {
            return "";
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private String formatDate(LocalDate date) {
        return date == null ? "" : DateTimeFormatter.ISO_LOCAL_DATE.format(date);
    }

    private String formatAmount(BigDecimal amount) {
        if (amount == null) {
            return BigDecimal.ZERO.setScale(AMOUNT_SCALE).toPlainString();
        }
        return amount.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP).toPlainString();
    }

    private record ExportedEntry(AccountingEntry entry, List<AccountingEntryLine> lines) {
    }
}
