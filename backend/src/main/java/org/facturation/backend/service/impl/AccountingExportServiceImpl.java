package org.facturation.backend.service.impl;

import jakarta.transaction.Transactional;
import org.facturation.backend.exception.AccountingExportFileNotFoundException;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.ExportBatch;
import org.facturation.backend.model.ExportBatchFormat;
import org.facturation.backend.model.ExportBatchStatusCode;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.ExportBatchRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.AccountingExportService;
import org.facturation.backend.service.AccountingExportValidator;
import org.facturation.backend.service.AccountingExportValidator.ValidatedEntry;
import org.facturation.backend.service.AccountingPieceNumberService;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.storage.AccountingExportFileStorageService;
import org.facturation.backend.service.storage.StoredAccountingExportFile;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class AccountingExportServiceImpl implements AccountingExportService {

    private static final int AMOUNT_SCALE = 2;
    private static final String HEADER =
            "entryNumber,entryDate,invoiceNumber,invoiceDate,supplierName,accountNumber,"
                    + "accountLabel,lineLabel,debitAmount,creditAmount,currencyCode";

    private final InvoiceRepository invoiceRepository;
    private final AccountingExportValidator accountingExportValidator;
    private final AccountingPieceNumberService accountingPieceNumberService;
    private final AuditLogRepository auditLogRepository;
    private final ExportBatchRepository exportBatchRepository;
    private final CurrentUserService currentUserService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final AccountingExportFileStorageService accountingExportFileStorageService;

    public AccountingExportServiceImpl(
            InvoiceRepository invoiceRepository,
            AccountingExportValidator accountingExportValidator,
            AccountingPieceNumberService accountingPieceNumberService,
            AuditLogRepository auditLogRepository,
            ExportBatchRepository exportBatchRepository,
            CurrentUserService currentUserService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            AccountingExportFileStorageService accountingExportFileStorageService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.accountingExportValidator = accountingExportValidator;
        this.accountingPieceNumberService = accountingPieceNumberService;
        this.auditLogRepository = auditLogRepository;
        this.exportBatchRepository = exportBatchRepository;
        this.currentUserService = currentUserService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.accountingExportFileStorageService = accountingExportFileStorageService;
    }

    @Override
    @Transactional
    public AccountingCsvExport exportCsv(LocalDate startDate, LocalDate endDate) {
        validatePeriod(startDate, endDate);
        User user = currentUserService.getCurrentUser();
        Long organizationId = user.getOrganization().getOrganizationId();
        Organization organization = accountingPieceNumberService.lockSequence(organizationId);
        List<Invoice> invoices = invoiceRepository.findAccountingExportCandidates(
                organizationId,
                startDate != null,
                startDate,
                endDate != null,
                endDate
        );
        if (invoices.isEmpty()) {
            throw new IllegalArgumentException("No exportable invoices found for accounting CSV export");
        }
        List<ValidatedEntry> exportedEntries = accountingExportValidator.validate(invoices);
        accountingPieceNumberService.assign(
                organization,
                exportedEntries.stream().map(ValidatedEntry::entry).toList()
        );

        String filename = buildFilename(startDate, endDate);
        byte[] content = buildCsv(exportedEntries).getBytes(StandardCharsets.UTF_8);
        ExportBatch exportBatch = createBatch(user, startDate, endDate, exportedEntries);
        StoredAccountingExportFile storedFile = accountingExportFileStorageService.store(
                content,
                filename,
                exportBatch.getExportBatchId()
        );
        markInvoicesExported(exportedEntries, user);
        markBatchGenerated(exportBatch, storedFile);
        recordExport(exportedEntries, user, filename, exportBatch);
        return new AccountingCsvExport(filename, content);
    }

    @Override
    @Transactional
    public AccountingCsvExport downloadFile(Long exportBatchId) {
        Long organizationId = currentUserService.getCurrentUser().getOrganization().getOrganizationId();
        ExportBatch exportBatch = exportBatchRepository
                .findByExportBatchIdAndOrganizationOrganizationId(exportBatchId, organizationId)
                .orElseThrow(() -> new AccountingExportFileNotFoundException(exportBatchId));
        return new AccountingCsvExport(
                exportBatch.getFileName(),
                accountingExportFileStorageService.load(exportBatch)
        );
    }

    private void validatePeriod(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate must be before or equal to endDate");
        }
    }

    private String buildCsv(List<ValidatedEntry> exportedEntries) {
        StringBuilder csv = new StringBuilder(HEADER).append('\n');
        for (ValidatedEntry exportedEntry : exportedEntries) {
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

    private void markInvoicesExported(List<ValidatedEntry> exportedEntries, User user) {
        for (ValidatedEntry exportedEntry : exportedEntries) {
            invoiceStatusWorkflowService.transitionTo(
                    exportedEntry.entry().getInvoice(),
                    InvoiceStatusCode.EXPORTEE,
                    user,
                    "Accounting CSV export completed"
            );
        }
    }

    private ExportBatch createBatch(
            User user,
            LocalDate startDate,
            LocalDate endDate,
            List<ValidatedEntry> exportedEntries
    ) {
        ExportBatch exportBatch = new ExportBatch();
        exportBatch.setOrganization(user.getOrganization());
        exportBatch.setCreatedByUser(user);
        exportBatch.setPeriodStartDate(startDate);
        exportBatch.setPeriodEndDate(endDate);
        exportBatch.setFormat(ExportBatchFormat.CSV.getCode());
        exportBatch.setStatus(ExportBatchStatusCode.PREPARATION.getCode());
        exportBatch.setCreatedAt(LocalDateTime.now());
        for (ValidatedEntry exportedEntry : exportedEntries) {
            exportBatch.addInvoice(exportedEntry.entry().getInvoice());
        }
        return exportBatchRepository.save(exportBatch);
    }

    private void markBatchGenerated(ExportBatch exportBatch, StoredAccountingExportFile storedFile) {
        exportBatch.setFileName(storedFile.fileName());
        exportBatch.setStoredFileName(storedFile.storedFileName());
        exportBatch.setFilePath(storedFile.filePath());
        exportBatch.setFileSize(storedFile.fileSize());
        exportBatch.setStatus(ExportBatchStatusCode.GENERE.getCode());
        exportBatch.setGeneratedAt(LocalDateTime.now());
        exportBatchRepository.save(exportBatch);
    }

    private void recordExport(
            List<ValidatedEntry> exportedEntries,
            User user,
            String filename,
            ExportBatch exportBatch
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(user);
        auditLog.setEntityName("AccountingCsvExport");
        auditLog.setEntityId(exportBatch.getExportBatchId());
        auditLog.setAction("CSV_EXPORT");
        auditLog.setOldValue("invoiceIds=" + exportedEntries.stream()
                .map(exportedEntry -> exportedEntry.entry().getInvoice().getInvoiceId().toString())
                .toList());
        auditLog.setNewValue("batchId=" + exportBatch.getExportBatchId()
                + ", filename=" + filename
                + ", entryCount=" + exportedEntries.size());
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
}
