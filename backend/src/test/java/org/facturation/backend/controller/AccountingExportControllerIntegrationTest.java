package org.facturation.backend.controller;

import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.ExportBatch;
import org.facturation.backend.model.ExportBatchFormat;
import org.facturation.backend.model.ExportBatchStatusCode;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.ExportBatchRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "ALTER TABLE invoices ALTER COLUMN invoice_id RESTART WITH 1000",
        "ALTER TABLE export_batches ALTER COLUMN export_batch_id RESTART WITH 1000",
        "ALTER TABLE accounting_entries ALTER COLUMN accounting_entry_id RESTART WITH 1000",
        "ALTER TABLE accounting_entry_lines ALTER COLUMN accounting_entry_line_id RESTART WITH 1000"
})
class AccountingExportControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountingEntryLineRepository accountingEntryLineRepository;

    @Autowired
    private AccountingEntryRepository accountingEntryRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private ChartOfAccountRepository chartOfAccountRepository;

    @Autowired
    private ExportBatchRepository exportBatchRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    @Autowired
    private InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void exportsValidatedInvoicesInTheRequestedPeriodAndMarksThemExported() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();
        Invoice exportedInvoice = createInvoice(user, InvoiceStatusCode.EXPORTABLE, "CSV-EXPORT", "EUR");
        createBalancedEntry(exportedInvoice, user, "CSV-ENTRY-1");
        Invoice nonExportableInvoice = createInvoice(user, InvoiceStatusCode.VALIDEE, "CSV-VALIDATED", "EUR");
        nonExportableInvoice.setInvoiceDate(LocalDate.of(2026, 9, 15));
        invoiceRepository.save(nonExportableInvoice);
        createBalancedEntry(nonExportableInvoice, user, "CSV-ENTRY-2");

        String csv = mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(new MediaType("text", "csv")))
                .andExpect(header().string(
                        HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.containsString("attachment; filename=\"accounting-export-2026-08-01_2026-08-31-")
                ))
                .andReturn().getResponse().getContentAsString();

        assertThat(csv).startsWith(
                "entryNumber,entryDate,invoiceNumber,invoiceDate,supplierName,accountNumber,"
                        + "accountLabel,lineLabel,debitAmount,creditAmount,currencyCode\n"
        );
        assertThat(csv).contains("\"1\",\"2026-08-15\",\"CSV-EXPORT\",\"2026-08-15\"");
        assertThat(csv).contains("\"607000\",\"Achats de marchandises\",\"Achat CSV-EXPORT\",\"100.00\",\"0.00\"");
        assertThat(csv).contains("\"445660\",\"TVA deductible sur autres biens et services\",\"TVA CSV-EXPORT\",\"20.00\",\"0.00\"");
        assertThat(csv).contains("\"401000\",\"Fournisseurs\",\"Fournisseur CSV-EXPORT\",\"0.00\",\"120.00\"");
        assertThat(csv).doesNotContain("CSV-VALIDATED");

        assertThat(invoiceRepository.findById(exportedInvoice.getInvoiceId()).orElseThrow()
                .getInvoiceStatus().getCode()).isEqualTo(InvoiceStatusCode.EXPORTEE.getCode());
        assertThat(accountingEntryRepository
                .findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(exportedInvoice.getInvoiceId())
                .orElseThrow().getEntryNumber()).isEqualTo("1");
        assertThat(invoiceRepository.findById(exportedInvoice.getInvoiceId()).orElseThrow()
                .getExportBatch().getExportBatchId()).isEqualTo(1000L);
        assertThat(invoiceStatusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        exportedInvoice.getInvoiceId(),
                        user.getOrganization().getOrganizationId()
                ))
                .anySatisfy(history -> {
                    assertThat(history.getInvoiceStatus().getCode()).isEqualTo(InvoiceStatusCode.EXPORTEE.getCode());
                    assertThat(history.getChangedByUser().getUserId()).isEqualTo(user.getUserId());
                    assertThat(history.getComment()).isEqualTo("Accounting CSV export completed");
                });
        assertThat(invoiceRepository.findById(nonExportableInvoice.getInvoiceId()).orElseThrow()
                .getInvoiceStatus().getCode()).isEqualTo(InvoiceStatusCode.VALIDEE.getCode());
        assertThat(invoiceRepository.findById(nonExportableInvoice.getInvoiceId()).orElseThrow()
                .getExportBatch()).isNull();

        List<ExportBatch> exportBatches = exportBatchRepository.findAll();
        assertThat(exportBatches).hasSize(1);
        ExportBatch exportBatch = exportBatches.getFirst();
        assertThat(exportBatch.getExportBatchId()).isEqualTo(1000L);
        assertThat(exportBatch.getOrganization().getOrganizationId()).isEqualTo(user.getOrganization().getOrganizationId());
        assertThat(exportBatch.getCreatedByUser().getUserId()).isEqualTo(user.getUserId());
        assertThat(exportBatch.getPeriodStartDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(exportBatch.getPeriodEndDate()).isEqualTo(LocalDate.of(2026, 8, 31));
        assertThat(exportBatch.getFormat()).isEqualTo(ExportBatchFormat.CSV.getCode());
        assertThat(exportBatch.getStatus()).isEqualTo(ExportBatchStatusCode.GENERE.getCode());
        assertThat(exportBatch.getFileName()).startsWith("accounting-export-2026-08-01_2026-08-31-");
        assertThat(exportBatch.getFileName()).endsWith(".csv");
        assertThat(exportBatch.getStoredFileName()).endsWith("-" + exportBatch.getFileName());
        assertThat(exportBatch.getFilePath()).endsWith(exportBatch.getStoredFileName());
        assertThat(exportBatch.getFileSize()).isEqualTo(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
        assertThat(exportBatch.getGeneratedAt()).isNotNull();

        mockMvc.perform(get("/api/v1/accounting-exports/{id}/file", exportBatch.getExportBatchId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(new MediaType("text", "csv")))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, exportBatch.getFileSize()))
                .andExpect(header().string(
                        HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.containsString("attachment; filename=\"" + exportBatch.getFileName())
                ))
                .andExpect(content().bytes(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8)));

        List<AuditLog> exportLogs = auditLogRepository.findAll().stream()
                .filter(log -> "AccountingCsvExport".equals(log.getEntityName()))
                .filter(log -> "CSV_EXPORT".equals(log.getAction()))
                .toList();
        assertThat(exportLogs).hasSize(1);
        assertThat(exportLogs.getFirst().getEntityId()).isEqualTo(1000L);
        assertThat(exportLogs.getFirst().getOldValue()).contains(exportedInvoice.getInvoiceId().toString());
        assertThat(exportLogs.getFirst().getNewValue()).contains("batchId=1000");
        assertThat(exportLogs.getFirst().getNewValue()).contains("entryCount=1");

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("No exportable invoices found; invoices already exported cannot be exported again"));

        assertThat(exportBatchRepository.findAll()).hasSize(1);
        assertThat(auditLogRepository.findAll().stream()
                .filter(log -> "CSV_EXPORT".equals(log.getAction())))
                .hasSize(1);
        assertThat(invoiceStatusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        exportedInvoice.getInvoiceId(),
                        user.getOrganization().getOrganizationId()
                ).stream()
                .filter(history -> InvoiceStatusCode.EXPORTEE.getCode().equals(history.getInvoiceStatus().getCode())))
                .hasSize(1);
    }

    @Test
    void reportsAllBlockingErrorsForEveryInvoiceWithoutApplyingExportStatus() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();
        Invoice invoiceWithSeveralErrors = createInvoice(
                user,
                InvoiceStatusCode.EXPORTABLE,
                "CSV-INVALID",
                "EUR"
        );
        invoiceWithSeveralErrors.setTotalTva(new BigDecimal("21.00"));
        invoiceRepository.save(invoiceWithSeveralErrors);
        createBalancedEntry(invoiceWithSeveralErrors, user, "CSV-ENTRY-INVALID");

        AccountingEntry entry = accountingEntryRepository
                .findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(invoiceWithSeveralErrors.getInvoiceId())
                .orElseThrow();
        entry.setEntryNumber(" ");
        accountingEntryRepository.save(entry);

        List<AccountingEntryLine> lines = accountingEntryLineRepository
                .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entry.getAccountingEntryId());
        lines.getLast().setCreditAmount(new BigDecimal("119.00"));
        accountingEntryLineRepository.saveAll(lines);

        Invoice invoiceWithoutEntry = createInvoice(
                user,
                InvoiceStatusCode.EXPORTABLE,
                "CSV-NO-ENTRY",
                "EUR"
        );

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNTING_EXPORT_VALIDATION_FAILED"))
                .andExpect(jsonPath("$.invoices.length()").value(2))
                .andExpect(jsonPath("$.invoices[0].invoiceId").value(invoiceWithSeveralErrors.getInvoiceId()))
                .andExpect(jsonPath("$.invoices[0].invoiceNumber").value("CSV-INVALID"))
                .andExpect(jsonPath("$.invoices[0].errors[*].code", containsInAnyOrder(
                        "VAT_INCONSISTENT",
                        "ACCOUNTING_ENTRY_UNBALANCED"
                )))
                .andExpect(jsonPath("$.invoices[1].invoiceId").value(invoiceWithoutEntry.getInvoiceId()))
                .andExpect(jsonPath("$.invoices[1].invoiceNumber").value("CSV-NO-ENTRY"))
                .andExpect(jsonPath("$.invoices[1].errors[0].code").value("ACCOUNTING_ENTRY_MISSING"));

        assertThat(invoiceRepository.findById(invoiceWithSeveralErrors.getInvoiceId()).orElseThrow()
                .getInvoiceStatus().getCode()).isEqualTo(InvoiceStatusCode.EXPORTABLE.getCode());
        assertThat(invoiceRepository.findById(invoiceWithoutEntry.getInvoiceId()).orElseThrow()
                .getInvoiceStatus().getCode()).isEqualTo(InvoiceStatusCode.EXPORTABLE.getCode());
        assertThat(exportBatchRepository.findAll()).isEmpty();
        assertThat(auditLogRepository.findAll()).noneMatch(log -> "CSV_EXPORT".equals(log.getAction()));
    }

    @Test
    void returnsAllBlockingControlsBeforeGeneratingTheExport() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();
        Invoice invalidInvoice = createInvoice(user, InvoiceStatusCode.EXPORTABLE, "CSV-INVALID", "EUR");
        invalidInvoice.setTotalTva(new BigDecimal("21.00"));
        invoiceRepository.save(invalidInvoice);
        createBalancedEntry(invalidInvoice, user, "CSV-ENTRY-INVALID");

        AccountingEntry entry = accountingEntryRepository
                .findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(invalidInvoice.getInvoiceId())
                .orElseThrow();
        entry.setEntryNumber(" ");
        accountingEntryRepository.save(entry);

        ChartOfAccount inactiveAccount = chartOfAccountRepository.findById(2L).orElseThrow();
        inactiveAccount.setActive(false);
        chartOfAccountRepository.save(inactiveAccount);
        List<AccountingEntryLine> lines = accountingEntryLineRepository
                .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entry.getAccountingEntryId());
        lines.getFirst().setAccount(inactiveAccount);
        lines.getLast().setCreditAmount(new BigDecimal("119.00"));
        accountingEntryLineRepository.saveAll(lines);

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNTING_EXPORT_VALIDATION_FAILED"))
                .andExpect(jsonPath("$.invoices[0].invoiceId").value(invalidInvoice.getInvoiceId()))
                .andExpect(jsonPath("$.invoices[0].invoiceNumber").value("CSV-INVALID"))
                .andExpect(jsonPath("$.invoices[0].errors[*].code", containsInAnyOrder(
                        "VAT_INCONSISTENT",
                        "ACCOUNT_INACTIVE",
                        "ACCOUNTING_ENTRY_UNBALANCED"
                )));

        assertThat(invoiceRepository.findById(invalidInvoice.getInvoiceId()).orElseThrow()
                .getInvoiceStatus().getCode()).isEqualTo(InvoiceStatusCode.EXPORTABLE.getCode());
        assertThat(exportBatchRepository.findAll()).isEmpty();
        assertThat(auditLogRepository.findAll()).noneMatch(log -> "CSV_EXPORT".equals(log.getAction()));
    }

    @Test
    void rejectsInvalidPeriodWithoutChangingInvoices() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();
        Invoice exportableInvoice = createInvoice(user, InvoiceStatusCode.EXPORTABLE, "CSV-INVALID-PERIOD", "EUR");
        createBalancedEntry(exportableInvoice, user, "CSV-ENTRY-INVALID-PERIOD");

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-08-31")
                        .param("endDate", "2026-08-01")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("startDate must be before or equal to endDate"));

        assertThat(invoiceRepository.findById(exportableInvoice.getInvoiceId()).orElseThrow()
                .getInvoiceStatus().getCode()).isEqualTo(InvoiceStatusCode.EXPORTABLE.getCode());
        assertThat(exportBatchRepository.findAll()).isEmpty();
    }

    @Test
    void selectsExportableInvoicesWithinInclusivePeriodForCurrentOrganization() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();
        Invoice startBoundary = createInvoice(
                user, InvoiceStatusCode.EXPORTABLE, "CSV-START-BOUNDARY", "EUR", LocalDate.of(2026, 8, 1)
        );
        Invoice endBoundary = createInvoice(
                user, InvoiceStatusCode.EXPORTABLE, "CSV-END-BOUNDARY", "EUR", LocalDate.of(2026, 8, 31)
        );
        Invoice beforePeriod = createInvoice(
                user, InvoiceStatusCode.EXPORTABLE, "CSV-BEFORE-PERIOD", "EUR", LocalDate.of(2026, 7, 31)
        );
        Invoice afterPeriod = createInvoice(
                user, InvoiceStatusCode.EXPORTABLE, "CSV-AFTER-PERIOD", "EUR", LocalDate.of(2026, 9, 1)
        );
        Invoice alreadyExported = createInvoice(
                user, InvoiceStatusCode.EXPORTEE, "CSV-ALREADY-EXPORTED", "EUR", LocalDate.of(2026, 8, 15)
        );
        User otherOrganizationUser = createUserForAnotherOrganization();
        Invoice otherOrganizationInvoice = createInvoice(
                otherOrganizationUser,
                InvoiceStatusCode.EXPORTABLE,
                "CSV-OTHER-ORGANIZATION",
                "EUR",
                LocalDate.of(2026, 8, 15)
        );

        createBalancedEntry(startBoundary, user, "CSV-ENTRY-START-BOUNDARY");
        createBalancedEntry(endBoundary, user, "CSV-ENTRY-END-BOUNDARY");
        createBalancedEntry(beforePeriod, user, "CSV-ENTRY-BEFORE-PERIOD");
        createBalancedEntry(afterPeriod, user, "CSV-ENTRY-AFTER-PERIOD");
        createBalancedEntry(alreadyExported, user, "CSV-ENTRY-ALREADY-EXPORTED");
        createEntry(otherOrganizationInvoice, otherOrganizationUser, "CSV-ENTRY-OTHER-ORGANIZATION");

        String csv = mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(csv).contains("CSV-START-BOUNDARY", "CSV-END-BOUNDARY");
        assertThat(csv).doesNotContain(
                "CSV-BEFORE-PERIOD",
                "CSV-AFTER-PERIOD",
                "CSV-ALREADY-EXPORTED",
                "CSV-OTHER-ORGANIZATION"
        );
        assertThat(statusOf(startBoundary)).isEqualTo(InvoiceStatusCode.EXPORTEE.getCode());
        assertThat(statusOf(endBoundary)).isEqualTo(InvoiceStatusCode.EXPORTEE.getCode());
        assertThat(statusOf(beforePeriod)).isEqualTo(InvoiceStatusCode.EXPORTABLE.getCode());
        assertThat(statusOf(afterPeriod)).isEqualTo(InvoiceStatusCode.EXPORTABLE.getCode());
        assertThat(statusOf(otherOrganizationInvoice)).isEqualTo(InvoiceStatusCode.EXPORTABLE.getCode());
    }

    @Test
    void excludesInvoiceAlreadyLinkedToAnExportBatchEvenIfItsStatusIsExportable() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();
        Invoice alreadyLinkedInvoice = createInvoice(
                user, InvoiceStatusCode.EXPORTABLE, "CSV-ALREADY-LINKED", "EUR"
        );
        createBalancedEntry(alreadyLinkedInvoice, user, "CSV-ENTRY-ALREADY-LINKED");

        ExportBatch previousBatch = new ExportBatch();
        previousBatch.setOrganization(user.getOrganization());
        previousBatch.setCreatedByUser(user);
        previousBatch.setPeriodStartDate(LocalDate.of(2026, 8, 1));
        previousBatch.setPeriodEndDate(LocalDate.of(2026, 8, 31));
        previousBatch.setFormat(ExportBatchFormat.CSV.getCode());
        previousBatch.setStatus(ExportBatchStatusCode.GENERE.getCode());
        previousBatch.setCreatedAt(LocalDateTime.now());
        previousBatch.setGeneratedAt(LocalDateTime.now());
        exportBatchRepository.save(previousBatch);
        alreadyLinkedInvoice.setExportBatch(previousBatch);
        invoiceRepository.save(alreadyLinkedInvoice);

        Invoice newInvoice = createInvoice(user, InvoiceStatusCode.EXPORTABLE, "CSV-NEW", "EUR");
        createBalancedEntry(newInvoice, user, "CSV-ENTRY-NEW");

        String csv = mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(csv).contains("CSV-NEW").doesNotContain("CSV-ALREADY-LINKED");
        assertThat(statusOf(alreadyLinkedInvoice)).isEqualTo(InvoiceStatusCode.EXPORTABLE.getCode());
        assertThat(invoiceRepository.findById(alreadyLinkedInvoice.getInvoiceId()).orElseThrow()
                .getExportBatch().getExportBatchId()).isEqualTo(previousBatch.getExportBatchId());
        assertThat(exportBatchRepository.findAll()).hasSize(2);
    }

    @Test
    void continuesTheOrganizationPieceNumberSequenceAcrossExports() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();
        Invoice firstInvoice = createInvoice(
                user, InvoiceStatusCode.EXPORTABLE, "CSV-FIRST", "EUR", LocalDate.of(2026, 8, 15)
        );
        Invoice secondInvoice = createInvoice(
                user, InvoiceStatusCode.EXPORTABLE, "CSV-SECOND", "EUR", LocalDate.of(2026, 9, 15)
        );
        createBalancedEntry(firstInvoice, user, "TEMP-FIRST");
        createBalancedEntry(secondInvoice, user, "TEMP-SECOND");

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "\"1\",\"2026-08-15\",\"CSV-FIRST\""
                )));

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-09-01")
                        .param("endDate", "2026-09-30")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "\"2\",\"2026-09-15\",\"CSV-SECOND\""
                )));

        assertThat(accountingEntryRepository
                .findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(firstInvoice.getInvoiceId())
                .orElseThrow().getEntryNumber()).isEqualTo("1");
        assertThat(accountingEntryRepository
                .findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(secondInvoice.getInvoiceId())
                .orElseThrow().getEntryNumber()).isEqualTo("2");
        assertThat(organizationRepository.findById(1L).orElseThrow().getNextAccountingPieceNumber()).isEqualTo(3L);
    }

    @Test
    void rejectsExportWhenNoInvoiceIsExportable() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-01-01")
                        .param("endDate", "2026-01-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(user)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("No exportable invoices found; invoices already exported cannot be exported again"));

        assertThat(exportBatchRepository.findAll()).isEmpty();
    }

    @Test
    void hidesStoredExportFileFromAnotherOrganization() throws Exception {
        User owner = userRepository.findById(1L).orElseThrow();
        Invoice invoice = createInvoice(owner, InvoiceStatusCode.EXPORTABLE, "CSV-OWNER", "EUR");
        createBalancedEntry(invoice, owner, "CSV-ENTRY-OWNER");

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner)))
                .andExpect(status().isOk());

        Long exportBatchId = exportBatchRepository.findAll().getFirst().getExportBatchId();
        User otherOrganizationUser = createUserForAnotherOrganization();

        mockMvc.perform(get("/api/v1/accounting-exports/{id}/file", exportBatchId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(otherOrganizationUser)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACCOUNTING_EXPORT_FILE_NOT_FOUND"));
    }

    private Invoice createInvoice(User user, InvoiceStatusCode statusCode, String invoiceNumber, String currencyCode) {
        return createInvoice(user, statusCode, invoiceNumber, currencyCode, LocalDate.of(2026, 8, 15));
    }

    private Invoice createInvoice(
            User user,
            InvoiceStatusCode statusCode,
            String invoiceNumber,
            String currencyCode,
            LocalDate invoiceDate
    ) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(user.getOrganization());
        invoice.setCreatedByUser(user);
        if (user.getOrganization().getOrganizationId().equals(1L)) {
            invoice.setSupplier(supplierRepository.findById(1L).orElseThrow());
        }
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(statusCode.getCode()).orElseThrow());
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setInvoiceDate(invoiceDate);
        invoice.setCurrencyCode(currencyCode);
        invoice.setTotalHt(new BigDecimal("100.00"));
        invoice.setTotalTva(new BigDecimal("20.00"));
        invoice.setTotalTtc(new BigDecimal("120.00"));
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private User createUserForAnotherOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("KAN-126 other organization");
        organization.setLegalName("KAN-126 Other Organization SAS");
        organization.setSiret("73282932000074");
        organization.setEmail("kan-126-other-organization@example.com");
        organization.setDefaultCurrencyCode("EUR");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        organizationRepository.save(organization);

        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findByCode("OPERATEUR_COMPTABLE").orElseThrow());
        user.setFirstName("Other");
        user.setLastName("Operator");
        user.setEmail("kan-126-other-organization-user@example.com");
        user.setPasswordHash("not-used");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private String statusOf(Invoice invoice) {
        return invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow().getInvoiceStatus().getCode();
    }

    private void createBalancedEntry(Invoice invoice, User user, String entryNumber) {
        AccountingEntry entry = createEntry(invoice, user, entryNumber);

        createLine(entry, 1, 2L, "Achat " + invoice.getInvoiceNumber(), "100.00", "0.00");
        createLine(entry, 2, 3L, "TVA " + invoice.getInvoiceNumber(), "20.00", "0.00");
        createLine(entry, 3, 1L, "Fournisseur " + invoice.getInvoiceNumber(), "0.00", "120.00");
    }

    private AccountingEntry createEntry(Invoice invoice, User user, String entryNumber) {
        AccountingEntry entry = new AccountingEntry();
        entry.setInvoice(invoice);
        entry.setCreatedByUser(user);
        entry.setEntryNumber(entryNumber);
        entry.setEntryDate(invoice.getInvoiceDate());
        entry.setLabel("Ecriture " + invoice.getInvoiceNumber());
        entry.setStatus("GENERATED");
        entry.setCreatedAt(LocalDateTime.now());
        entry.setUpdatedAt(LocalDateTime.now());
        return accountingEntryRepository.save(entry);
    }

    private void createLine(
            AccountingEntry entry,
            int lineNumber,
            Long accountId,
            String label,
            String debitAmount,
            String creditAmount
    ) {
        ChartOfAccount account = chartOfAccountRepository.findById(accountId).orElseThrow();
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(entry);
        line.setAccount(account);
        line.setLineNumber(lineNumber);
        line.setLineLabel(label);
        line.setDebitAmount(new BigDecimal(debitAmount));
        line.setCreditAmount(new BigDecimal(creditAmount));
        line.setCreatedAt(LocalDateTime.now());
        accountingEntryLineRepository.save(line);
    }

    private String tokenFor(User user) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(user);
    }
}
