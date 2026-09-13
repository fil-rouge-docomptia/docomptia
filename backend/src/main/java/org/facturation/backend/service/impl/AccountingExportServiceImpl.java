package org.facturation.backend.service.impl;

import jakarta.transaction.Transactional;
import org.facturation.backend.dto.request.AccountingExportPreflightRequest;
import org.facturation.backend.dto.request.AccountingExportSelectionRequest;
import org.facturation.backend.dto.response.AccountingExportGenerationResponse;
import org.facturation.backend.exception.AccountingExportArchiveNotAllowedException;
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
import org.facturation.backend.service.AccountingExportFailureAuditService;
import org.facturation.backend.service.AccountingExportService;
import org.facturation.backend.service.AccountingExportReadService;
import org.facturation.backend.service.AccountingExportValidator;
import org.facturation.backend.service.AccountingExportValidator.ValidatedEntry;
import org.facturation.backend.service.AccountingPieceNumberService;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.storage.AccountingExportFileStorageService;
import org.facturation.backend.service.storage.StoredAccountingExportFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

@Service
public class AccountingExportServiceImpl implements AccountingExportService {

    private static final Logger log = LoggerFactory.getLogger(AccountingExportServiceImpl.class);

    private static final int AMOUNT_SCALE = 2;
    private static final String CSV_HEADER =
            "entryNumber,entryDate,invoiceNumber,invoiceDate,supplierName,accountNumber,"
                    + "accountLabel,lineLabel,debitAmount,creditAmount,currencyCode";
    private static final String FEC_HEADER =
            "JournalCode\tJournalLib\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tCompAuxNum\t"
                    + "CompAuxLib\tPieceRef\tPieceDate\tEcritureLib\tDebit\tCredit\tEcritureLet\tDateLet\t"
                    + "ValidDate\tMontantdevise\tIdevise";
    private static final String PURCHASE_JOURNAL_CODE = "AC";
    private static final String PURCHASE_JOURNAL_LABEL = "Achats";

    private final AccountingExportReadService readService;
    private final InvoiceRepository invoiceRepository;
    private final AccountingExportValidator accountingExportValidator;
    private final AccountingPieceNumberService accountingPieceNumberService;
    private final AuditLogRepository auditLogRepository;
    private final ExportBatchRepository exportBatchRepository;
    private final CurrentUserService currentUserService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final AccountingExportFileStorageService accountingExportFileStorageService;
    private final AccountingExportFailureAuditService accountingExportFailureAuditService;

    public AccountingExportServiceImpl(
            InvoiceRepository invoiceRepository,
            AccountingExportValidator accountingExportValidator,
            AccountingPieceNumberService accountingPieceNumberService,
            AuditLogRepository auditLogRepository,
            ExportBatchRepository exportBatchRepository,
            CurrentUserService currentUserService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            AccountingExportFileStorageService accountingExportFileStorageService,
            AccountingExportFailureAuditService accountingExportFailureAuditService,
            AccountingExportReadService readService
    ) {
        this.readService = readService;
        this.invoiceRepository = invoiceRepository;
        this.accountingExportValidator = accountingExportValidator;
        this.accountingPieceNumberService = accountingPieceNumberService;
        this.auditLogRepository = auditLogRepository;
        this.exportBatchRepository = exportBatchRepository;
        this.currentUserService = currentUserService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.accountingExportFileStorageService = accountingExportFileStorageService;
        this.accountingExportFailureAuditService = accountingExportFailureAuditService;
    }

    @Override
    @Transactional
    public AccountingCsvExport exportCsv(LocalDate startDate, LocalDate endDate) {
        return export(startDate, endDate, ExportBatchFormat.CSV, null).file();
    }

    @Override
    @Transactional
    public AccountingCsvExport exportFec(LocalDate startDate, LocalDate endDate) {
        return export(startDate, endDate, ExportBatchFormat.FEC, null).file();
    }

    @Override
    @Transactional
    public AccountingExportGenerationResponse generate(AccountingExportPreflightRequest request) {
        if (request.format() == null) {
            throw new IllegalArgumentException("Select an export format");
        }
        GeneratedExport generated = export(request.startDate(), request.endDate(), request.format(),
                new AccountingExportSelectionRequest(request.startDate(), request.endDate(), request.invoiceIds()));
        ExportBatch batch = generated.batch();
        User author = batch.getCreatedByUser();
        return new AccountingExportGenerationResponse(batch.getExportBatchId(),
                batch.getOrganization().getOrganizationId(), request.format(), batch.getStatus(),
                batch.getFileName(), batch.getFileSize(), batch.getGeneratedAt(),
                author.getFirstName() + " " + author.getLastName(),
                batch.getInvoices().stream().map(Invoice::getInvoiceId).toList());
    }

    private record GeneratedExport(ExportBatch batch, AccountingCsvExport file) {
    }

    private GeneratedExport export(
            LocalDate startDate,
            LocalDate endDate,
            ExportBatchFormat format,
            AccountingExportSelectionRequest selection
    ) {
        User user = currentUserService.getCurrentUser();
        List<Invoice> invoices = List.of();
        try {
            validatePeriod(startDate, endDate);
            Long organizationId = user.getOrganization().getOrganizationId();
            Organization organization = accountingPieceNumberService.lockSequence(organizationId);
            invoices = selection != null ? readService.selectedInvoices(organization, selection)
                    : invoiceRepository.findAccountingExportCandidates(
                    organizationId,
                    startDate != null,
                    startDate,
                    endDate != null,
                    endDate
            );
            if (invoices.isEmpty()) {
                throw new IllegalArgumentException(
                        "No exportable invoices found; invoices already exported cannot be exported again"
                );
            }
            List<ValidatedEntry> exportedEntries = format == ExportBatchFormat.FEC
                    ? accountingExportValidator.validateForFec(invoices)
                    : accountingExportValidator.validate(invoices);
            if (format == ExportBatchFormat.FEC) {
                exportedEntries = sortForFec(exportedEntries);
            }
            accountingPieceNumberService.assign(
                    organization,
                    exportedEntries.stream().map(ValidatedEntry::entry).toList()
            );

            String filename = format == ExportBatchFormat.FEC
                    ? buildFecFilename(organization, endDate)
                    : buildCsvFilename(startDate, endDate);
            String exportContent = format == ExportBatchFormat.FEC
                    ? buildFec(exportedEntries)
                    : buildCsv(exportedEntries);
            byte[] content = exportContent.getBytes(StandardCharsets.UTF_8);
            ExportBatch exportBatch = createBatch(user, startDate, endDate, exportedEntries, format);
            StoredAccountingExportFile storedFile = accountingExportFileStorageService.store(
                    content,
                    filename,
                    exportBatch.getExportBatchId()
            );
            removeFileOnRollback(storedFile);
            markInvoicesExported(exportedEntries, user, format);
            markBatchGenerated(exportBatch, storedFile);
            recordSuccessfulExport(exportedEntries, user, startDate, endDate, filename, exportBatch, format);
            exportBatchRepository.flush();
            return new GeneratedExport(exportBatch, new AccountingCsvExport(filename, content));
        } catch (RuntimeException exception) {
            recordFailedExportAfterRollback(user, startDate, endDate, invoices, format, exception);
            throw exception;
        }
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

    @Override
    @Transactional
    public AccountingExportArchive archiveFile(Long exportBatchId) {
        Long organizationId = currentUserService.getCurrentUser().getOrganization().getOrganizationId();
        ExportBatch exportBatch = exportBatchRepository
                .findByExportBatchIdAndOrganizationOrganizationId(exportBatchId, organizationId)
                .orElseThrow(() -> new AccountingExportFileNotFoundException(exportBatchId));
        if (!ExportBatchStatusCode.GENERE.getCode().equals(exportBatch.getStatus())) {
            throw new AccountingExportArchiveNotAllowedException(exportBatchId, exportBatch.getStatus());
        }

        LocalDateTime archivedAt = LocalDateTime.now();
        exportBatch.setStatus(ExportBatchStatusCode.ARCHIVE.getCode());
        exportBatch.setArchivedAt(archivedAt);
        exportBatchRepository.save(exportBatch);
        return new AccountingExportArchive(exportBatchId, exportBatch.getStatus(), archivedAt);
    }

    private void validatePeriod(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate must be before or equal to endDate");
        }
    }

    private String buildCsv(List<ValidatedEntry> exportedEntries) {
        StringBuilder csv = new StringBuilder(CSV_HEADER).append('\n');
        for (ValidatedEntry exportedEntry : exportedEntries) {
            AccountingEntry entry = exportedEntry.entry();
            Invoice invoice = entry.getInvoice();
            for (AccountingEntryLine line : exportedEntry.lines()) {
                appendCsvRow(csv, entry, invoice, line);
            }
        }
        return csv.toString();
    }

    private String buildFec(List<ValidatedEntry> exportedEntries) {
        StringBuilder fec = new StringBuilder(FEC_HEADER).append('\n');
        for (ValidatedEntry exportedEntry : exportedEntries) {
            AccountingEntry entry = exportedEntry.entry();
            Invoice invoice = entry.getInvoice();
            for (AccountingEntryLine line : exportedEntry.lines()) {
                fec.append(PURCHASE_JOURNAL_CODE).append('\t')
                        .append(PURCHASE_JOURNAL_LABEL).append('\t')
                        .append(entry.getEntryNumber()).append('\t')
                        .append(formatFecDate(entry.getEntryDate())).append('\t')
                        .append(line.getAccount().getAccountNumber()).append('\t')
                        .append(line.getAccount().getAccountLabel()).append('\t')
                        .append(line.getSupplierAccount() == null ? "" : line.getSupplierAccount().getCode()).append('\t')
                        .append(line.getSupplierAccount() == null ? "" : line.getSupplierAccount().getLabel()).append('\t')
                        .append(invoice.getInvoiceNumber()).append('\t')
                        .append(formatFecDate(invoice.getInvoiceDate())).append('\t')
                        .append(entry.getLabel()).append('\t')
                        .append(formatAmount(line.getDebitAmount())).append('\t')
                        .append(formatAmount(line.getCreditAmount())).append('\t')
                        .append('\t')
                        .append('\t')
                        .append(formatFecDate(entry.getEntryDate())).append('\t')
                        .append('\t')
                        .append('\n');
            }
        }
        return fec.toString();
    }

    private List<ValidatedEntry> sortForFec(List<ValidatedEntry> exportedEntries) {
        return exportedEntries.stream()
                .sorted(Comparator.comparing((ValidatedEntry item) -> item.entry().getEntryDate())
                        .thenComparing(item -> item.entry().getInvoice().getInvoiceId()))
                .toList();
    }

    private void appendCsvRow(StringBuilder csv, AccountingEntry entry, Invoice invoice, AccountingEntryLine line) {
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

    private void markInvoicesExported(
            List<ValidatedEntry> exportedEntries,
            User user,
            ExportBatchFormat format
    ) {
        for (ValidatedEntry exportedEntry : exportedEntries) {
            invoiceStatusWorkflowService.transitionTo(
                    exportedEntry.entry().getInvoice(),
                    InvoiceStatusCode.EXPORTEE,
                    user,
                    "Accounting " + format.getCode() + " export completed"
            );
        }
    }

    private ExportBatch createBatch(
            User user,
            LocalDate startDate,
            LocalDate endDate,
            List<ValidatedEntry> exportedEntries,
            ExportBatchFormat format
    ) {
        ExportBatch exportBatch = new ExportBatch();
        exportBatch.setOrganization(user.getOrganization());
        exportBatch.setCreatedByUser(user);
        exportBatch.setPeriodStartDate(startDate);
        exportBatch.setPeriodEndDate(endDate);
        exportBatch.setFormat(format.getCode());
        exportBatch.setStatus(ExportBatchStatusCode.PREPARATION.getCode());
        exportBatch.setCreatedAt(LocalDateTime.now());
        for (ValidatedEntry exportedEntry : exportedEntries) {
            exportBatch.addInvoice(exportedEntry.entry().getInvoice());
            exportedEntry.entry().setExportBatch(exportBatch);
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

    private void recordSuccessfulExport(
            List<ValidatedEntry> exportedEntries,
            User user,
            LocalDate startDate,
            LocalDate endDate,
            String filename,
            ExportBatch exportBatch,
            ExportBatchFormat format
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(user);
        auditLog.setEntityName(exportEntityName(format));
        auditLog.setEntityId(exportBatch.getExportBatchId());
        auditLog.setAction(format.getCode() + "_EXPORT");
        auditLog.setOldValue("format=" + format.getCode()
                + ", periodStartDate=" + startDate
                + ", periodEndDate=" + endDate
                + ", invoiceIds=" + exportedEntries.stream()
                .map(exportedEntry -> exportedEntry.entry().getInvoice().getInvoiceId())
                .toList());
        auditLog.setNewValue("result=SUCCESS, batchId=" + exportBatch.getExportBatchId()
                + ", filename=" + filename
                + ", entryCount=" + exportedEntries.size());
        auditLog.setCreatedAt(LocalDateTime.now());
        auditLogRepository.save(auditLog);
    }

    private void recordFailedExportAfterRollback(
            User user,
            LocalDate startDate,
            LocalDate endDate,
            List<Invoice> invoices,
            ExportBatchFormat format,
            RuntimeException exception
    ) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            accountingExportFailureAuditService.record(user, startDate, endDate, invoices, format, exception);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) {
                    accountingExportFailureAuditService.record(user, startDate, endDate, invoices, format, exception);
                }
            }
        });
    }

    private void removeFileOnRollback(StoredAccountingExportFile storedFile) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) {
                    try {
                        accountingExportFileStorageService.delete(storedFile);
                    } catch (RuntimeException exception) {
                        log.error("Unable to remove rolled-back accounting export file {}",
                                storedFile.storedFileName(), exception);
                    }
                }
            }
        });
    }

    private String buildCsvFilename(LocalDate startDate, LocalDate endDate) {
        String period = "all";
        if (startDate != null || endDate != null) {
            period = (startDate == null ? "start" : startDate.toString())
                    + "_"
                    + (endDate == null ? "end" : endDate.toString());
        }
        return "accounting-export-" + period + "-" + LocalDate.now() + ".csv";
    }

    private String buildFecFilename(Organization organization, LocalDate endDate) {
        LocalDate closingDate = endDate == null ? LocalDate.now() : endDate;
        return organization.getSiret().substring(0, 9)
                + "FEC"
                + formatFecDate(closingDate)
                + ".txt";
    }

    private String exportEntityName(ExportBatchFormat format) {
        return "Accounting" + format.getCode().charAt(0)
                + format.getCode().substring(1).toLowerCase() + "Export";
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

    private String formatFecDate(LocalDate date) {
        return date.format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    private String formatAmount(BigDecimal amount) {
        if (amount == null) {
            return BigDecimal.ZERO.setScale(AMOUNT_SCALE).toPlainString();
        }
        return amount.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP).toPlainString();
    }
}
