package org.facturation.backend.controller;

import org.facturation.backend.model.*;
import org.facturation.backend.repository.*;
import org.facturation.backend.service.AccountingPieceNumberService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.JwtTokenService;
import org.facturation.backend.service.storage.LocalAccountingExportFileStorageService;
import org.facturation.backend.service.storage.StoredAccountingExportFile;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Sql(executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS, statements = {
        "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 1000",
        "ALTER TABLE users ALTER COLUMN user_id RESTART WITH 1000",
        "ALTER TABLE chart_of_accounts ALTER COLUMN account_id RESTART WITH 1000",
        "ALTER TABLE invoices ALTER COLUMN invoice_id RESTART WITH 1000",
        "ALTER TABLE export_batches ALTER COLUMN export_batch_id RESTART WITH 1000",
        "ALTER TABLE accounting_entries ALTER COLUMN accounting_entry_id RESTART WITH 1000",
        "ALTER TABLE accounting_entry_lines ALTER COLUMN accounting_entry_line_id RESTART WITH 1000"
})
class AccountingExportGenerationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired OrganizationRepository organizations;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired InvoiceRepository invoices;
    @Autowired InvoiceStatusRepository statuses;
    @Autowired InvoiceStatusHistoryRepository history;
    @Autowired AccountingEntryRepository entries;
    @Autowired AccountingEntryLineRepository lines;
    @Autowired ChartOfAccountRepository accounts;
    @Autowired ExportBatchRepository batches;
    @Autowired AuditLogRepository audits;
    @Autowired JwtTokenService jwt;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoSpyBean LocalAccountingExportFileStorageService storage;
    @MockitoSpyBean InvoiceStatusWorkflowService workflow;
    @MockitoSpyBean AccountingPieceNumberService numbering;

    private static final Path FILES = Path.of(System.getProperty("java.io.tmpdir"), "kan359-" + UUID.randomUUID());
    private static final String ROOT = "/api/v1/accounting-exports";
    private User owner;
    private Long first;
    private Long second;
    private Long invalid;
    private TransactionTemplate tx;

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registry.add("app.storage.local-dir", FILES::toString);
    }

    @AfterAll
    static void removeTestFiles() throws Exception {
        if (Files.exists(FILES)) {
            try (var files = Files.walk(FILES)) {
                for (Path file : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
            }
        }
    }

    @BeforeEach
    void committedFixtures() {
        tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(ignored -> {
            var now = LocalDateTime.now();
            Organization org = new Organization();
            org.setName("KAN-359 " + UUID.randomUUID());
            org.setLegalName(org.getName());
            org.setEmail(UUID.randomUUID() + "@example.com");
            org.setSiret("73282932000074");
            org.setDefaultCurrencyCode("EUR");
            org.setCreatedAt(now);
            org.setUpdatedAt(now);
            organizations.save(org);
            owner = new User();
            owner.setOrganization(org);
            owner.setRole(roles.findByCode("ADMIN").orElseThrow());
            owner.setFirstName("Alexandre");
            owner.setLastName("Grodent");
            owner.setEmail(UUID.randomUUID() + "@example.com");
            owner.setPasswordHash("unused");
            owner.setActive(true);
            owner.setCreatedAt(now);
            owner.setUpdatedAt(now);
            users.save(owner);
            ChartOfAccount debit = account(org, "606000");
            ChartOfAccount credit = account(org, "401000");
            first = invoice("FIRST", debit, credit, true);
            second = invoice("SECOND", debit, credit, true);
            invalid = invoice("INVALID", debit, credit, false);
        });
    }

    @AfterEach
    void releaseFixtureSiret() {
        if (owner != null && owner.getUserId() != null) {
            tx.executeWithoutResult(ignored -> organizations.findById(owner.getOrganization().getOrganizationId())
                    .ifPresent(org -> org.setSiret("test-" + org.getOrganizationId())));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"CSV", "FEC"})
    void generatesOnlySelectionAndReturnsCommittedDownloadableReceipt(String format) throws Exception {
        MvcResult result = generate(format, first).andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationId").value(owner.getOrganization().getOrganizationId()))
                .andExpect(jsonPath("$.format").value(format)).andExpect(jsonPath("$.status").value("GENERE"))
                .andExpect(jsonPath("$.invoiceIds[0]").value(first))
                .andExpect(jsonPath("$.invoiceIds.length()").value(1))
                .andExpect(jsonPath("$.fileSize").isNumber()).andExpect(jsonPath("$.generatedAt").isNotEmpty())
                .andExpect(jsonPath("$.createdByName").value("Alexandre Grodent"))
                .andExpect(jsonPath("$.filePath").doesNotExist()).andExpect(jsonPath("$.storedFileName").doesNotExist())
                .andReturn();
        Long batchId = tx.execute(ignored -> invoices.findById(first).orElseThrow().getExportBatch().getExportBatchId());
        var downloaded = mvc.perform(get(ROOT + "/{id}/file", batchId).header(HttpHeaders.AUTHORIZATION, token()))
                .andExpect(status().isOk()).andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attachment")))
                .andExpect(content().string(containsString("FIRST")))
                .andExpect(content().string(not(containsString("SECOND")))).andReturn().getResponse().getContentAsByteArray();
        assertThat(result.getResponse().getContentAsString()).contains("\"fileSize\":" + downloaded.length);
        tx.executeWithoutResult(ignored -> {
            assertThat(state(first)).isEqualTo("EXPORTEE");
            assertThat(entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(first).orElseThrow()
                    .getExportBatch().getExportBatchId()).isEqualTo(batchId);
            assertThat(entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(second).orElseThrow()
                    .getExportBatch()).isNull();
            assertThat(state(second)).isEqualTo("EXPORTABLE");
            assertThat(state(invalid)).isEqualTo("EXPORTABLE");
            assertThat(organizations.findById(owner.getOrganization().getOrganizationId()).orElseThrow()
                    .getNextAccountingPieceNumber()).isEqualTo(2);
            assertThat(audits.findAll().stream().filter(log -> log.getOrganization().getOrganizationId()
                    .equals(owner.getOrganization().getOrganizationId()) && batchId.equals(log.getEntityId())
                    && (format + "_EXPORT").equals(log.getAction())).toList()).singleElement()
                    .satisfies(log -> assertThat(log.getNewValue()).contains("result=SUCCESS"));
        });
        generate(format, first).andExpect(status().isConflict());
        mvc.perform(get(ROOT).param("query", batchId.toString()).header(HttpHeaders.AUTHORIZATION, token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].downloadable").value(true));
        mvc.perform(post(ROOT + "/{id}/archive", batchId).header(HttpHeaders.AUTHORIZATION, token())).andExpect(status().isOk());
        mvc.perform(get(ROOT + "/{id}/file", batchId).header(HttpHeaders.AUTHORIZATION, token()))
                .andExpect(status().isOk()).andExpect(content().bytes(downloaded));
        mvc.perform(get(ROOT + "/{id}/file", batchId).with(user("admin@facturation-demo.fr").roles("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "OPERATEUR_COMPTABLE", "RESPONSABLE_COMPTABLE"})
    void allowsExistingExportRoles(String role) throws Exception {
        mvc.perform(post(ROOT + "/generate").with(user(owner.getEmail()).roles(role))
                .contentType(MediaType.APPLICATION_JSON).content(body("CSV", first))).andExpect(status().isOk());
    }

    @Test
    void requiresAuthenticationAndExportPermission() throws Exception {
        mvc.perform(post(ROOT + "/generate").contentType(MediaType.APPLICATION_JSON).content(body("CSV", first)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(ROOT + "/generate").with(user(owner.getEmail()).roles("UNKNOWN"))
                .contentType(MediaType.APPLICATION_JSON).content(body("CSV", first))).andExpect(status().isForbidden());
        assertUnchanged(first);
    }

    @Test
    void refusesMalformedAndUnavailableSelectionsWithoutExportingAnything() throws Exception {
        for (String body : List.of(body("CSV"), body("CSV", first, first), body("CSV", -1L),
                body("PDF", first), body("CSV", first).replace("\"CSV\"", "null"),
                body("CSV", first).replace("2042-08-31", "2042-07-31"))) {
            mvc.perform(post(ROOT + "/generate").header(HttpHeaders.AUTHORIZATION, token())
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        // Seed invoice 1 belongs to another organization; its existence must not be disclosed.
        for (Long unavailable : List.of(1L, Long.MAX_VALUE)) {
            generate("CSV", first, unavailable).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.invoices[0].invoiceId").isEmpty())
                    .andExpect(jsonPath("$.invoices[0].errors[0].code").value("SELECTION_CHANGED"));
        }
        assertUnchanged(first);
    }

    @Test
    void rechecksAccountingDataAtGenerationTime() throws Exception {
        generate("CSV", first, invalid).andExpect(status().isConflict())
                .andExpect(jsonPath("$.invoices[0].invoiceId").value(invalid));
        assertUnchanged(first);
        tx.executeWithoutResult(ignored -> organizations.findById(owner.getOrganization().getOrganizationId())
                .orElseThrow().setSiret("invalid"));
        generate("FEC", first).andExpect(status().isConflict());
        assertUnchanged(first);
    }

    @Test
    void rollsBackWhenStorageFailsAndRecordsFailureAudit() throws Exception {
        doThrow(new IllegalStateException("Storage unavailable")).when(storage).store(any(), anyString(), anyLong());
        assertThatThrownBy(() -> generate("CSV", first)).hasRootCauseInstanceOf(IllegalStateException.class);
        assertUnchanged(first);
        assertFailureAudit();
    }

    @Test
    void removesStoredFileAndRollsBackAllInvoicesWhenSecondTransitionFails() throws Exception {
        AtomicInteger transitions = new AtomicInteger();
        doAnswer(invocation -> {
            Object result = invocation.callRealMethod();
            if (transitions.incrementAndGet() == 2) throw new IllegalStateException("Simulated late failure");
            return result;
        }).when(workflow).transitionTo(any(), eq(InvoiceStatusCode.EXPORTEE), any(), anyString());
        assertThatThrownBy(() -> generate("CSV", first, second)).hasRootCauseInstanceOf(IllegalStateException.class);
        assertUnchanged(first);
        assertUnchanged(second);
        var file = org.mockito.ArgumentCaptor.forClass(StoredAccountingExportFile.class);
        verify(storage).delete(file.capture());
        assertThat(Path.of(file.getValue().filePath())).doesNotExist();
        assertFailureAudit();
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void serializesConcurrentSubmissionsWithoutDuplicateLotsOrPieceNumbers(boolean sameSelection) throws Exception {
        CountDownLatch bothLoadedOrganization = new CountDownLatch(2);
        doAnswer(invocation -> {
            bothLoadedOrganization.countDown();
            assertThat(bothLoadedOrganization.await(10, TimeUnit.SECONDS)).isTrue();
            return invocation.callRealMethod();
        }).when(numbering).lockSequence(owner.getOrganization().getOrganizationId());
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> generate("CSV", first).andReturn().getResponse().getStatus());
            var b = executor.submit(() -> generate("CSV", sameSelection ? first : second).andReturn().getResponse().getStatus());
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, sameSelection ? 409 : 200);
        }
        tx.executeWithoutResult(ignored -> {
            var ownBatches = batches.findAll().stream().filter(batch -> batch.getOrganization().getOrganizationId()
                    .equals(owner.getOrganization().getOrganizationId())).toList();
            assertThat(ownBatches).hasSize(sameSelection ? 1 : 2);
            var numbers = ownBatches.stream().flatMap(batch -> batch.getInvoices().stream())
                    .map(invoice -> entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(invoice.getInvoiceId())
                            .orElseThrow().getEntryNumber()).toList();
            assertThat(numbers).containsExactlyInAnyOrderElementsOf(sameSelection ? List.of("1") : List.of("1", "2"));
        });
    }

    @Test
    void retriesConcurrentLineAddsWithoutDuplicatingTheLineOrAudit() throws Exception {
        Long entryId = tx.execute(ignored -> entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(first)
                .orElseThrow().getAccountingEntryId());
        Long accountId = tx.execute(ignored -> lines.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entryId)
                .getFirst().getAccount().getAccountId());
        String payload = "{\"accountId\":" + accountId + ",\"lineLabel\":\"New line\",\"debitAmount\":5,\"creditAmount\":0}";
        String key = UUID.randomUUID().toString();
        synchronizeLineMutations();
        try (var executor = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Integer> add = () -> mvc.perform(post("/api/v1/accounting-entries/{id}/lines", entryId)
                    .header(HttpHeaders.AUTHORIZATION, token()).header("If-Match", "0").header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON).content(payload)).andReturn().getResponse().getStatus();
            var a = executor.submit(add);
            var b = executor.submit(add);
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsExactly(201, 201);
        }
        tx.executeWithoutResult(ignored -> {
            assertThat(lines.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entryId)).hasSize(3);
            assertThat(entries.findById(entryId).orElseThrow().getVersion()).isEqualTo(1);
            assertThat(audits.findAll().stream().filter(log -> log.getOrganization().getOrganizationId()
                    .equals(owner.getOrganization().getOrganizationId()) && "LINE_ADDED".equals(log.getAction())).count()).isEqualTo(9);
        });
    }

    @Test
    void rejectsConcurrentStaleLineEditsInsteadOfSilentlyOverwriting() throws Exception {
        Long entryId = tx.execute(ignored -> entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(first)
                .orElseThrow().getAccountingEntryId());
        Long lineId = tx.execute(ignored -> lines.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entryId)
                .getFirst().getAccountingEntryLineId());
        synchronizeLineMutations();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> editLine(entryId, lineId, "{\"lineLabel\":\"First change\"}").andReturn().getResponse().getStatus());
            var b = executor.submit(() -> editLine(entryId, lineId, "{\"lineLabel\":\"Second change\"}").andReturn().getResponse().getStatus());
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
        }
        tx.executeWithoutResult(ignored -> assertThat(entries.findById(entryId).orElseThrow().getVersion()).isEqualTo(1));
    }

    @Test
    void serializesLineCorrectionWithExportUsingTheSameOrganizationLock() throws Exception {
        Long entryId = tx.execute(ignored -> entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(first)
                .orElseThrow().getAccountingEntryId());
        Long lineId = tx.execute(ignored -> lines.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entryId)
                .getFirst().getAccountingEntryLineId());
        synchronizeLineMutations();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var edit = executor.submit(() -> editLine(entryId, lineId, "{\"debitAmount\":119}").andReturn().getResponse().getStatus());
            var export = executor.submit(() -> generate("CSV", first).andReturn().getResponse().getStatus());
            assertThat(List.of(edit.get(20, TimeUnit.SECONDS), export.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(200, 409);
        }
        tx.executeWithoutResult(ignored -> {
            var entry = entries.findById(entryId).orElseThrow();
            var amount = lines.findById(lineId).orElseThrow().getDebitAmount();
            if (entry.getExportBatch() != null) {
                assertThat(amount).isEqualByComparingTo("120");
                assertThat(state(first)).isEqualTo("EXPORTEE");
            } else {
                assertThat(amount).isEqualByComparingTo("119");
                assertThat(state(first)).isEqualTo("VALIDEE");
            }
        });
    }

    @Test
    void rollsBackLineAuditVersionAndReceiptWhenWorkflowFails() {
        Long entryId = tx.execute(ignored -> entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(first)
                .orElseThrow().getAccountingEntryId());
        Long lineId = tx.execute(ignored -> lines.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entryId)
                .getFirst().getAccountingEntryLineId());
        doThrow(new IllegalStateException("Workflow failure")).when(workflow).markAccountingEntryToCorrect(any(), any());
        assertThatThrownBy(() -> editLine(entryId, lineId, "{\"debitAmount\":119}")).hasRootCauseInstanceOf(IllegalStateException.class);
        tx.executeWithoutResult(ignored -> {
            assertThat(lines.findById(lineId).orElseThrow().getDebitAmount()).isEqualByComparingTo("120");
            assertThat(entries.findById(entryId).orElseThrow().getVersion()).isZero();
            assertThat(state(first)).isEqualTo("EXPORTABLE");
            assertThat(audits.findAll().stream().filter(log -> log.getOrganization().getOrganizationId()
                    .equals(owner.getOrganization().getOrganizationId()) && "LINE_CORRECTION".equals(log.getAction()))).isEmpty();
        });
    }

    private org.springframework.test.web.servlet.ResultActions editLine(Long entryId, Long lineId, String payload) throws Exception {
        return mvc.perform(patch("/api/v1/accounting-entries/{entryId}/lines/{lineId}", entryId, lineId)
                .header(HttpHeaders.AUTHORIZATION, token()).header("If-Match", "0").header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON).content(payload));
    }

    private void synchronizeLineMutations() {
        CountDownLatch bothArrived = new CountDownLatch(2);
        doAnswer(invocation -> {
            bothArrived.countDown();
            assertThat(bothArrived.await(10, TimeUnit.SECONDS)).isTrue();
            return invocation.callRealMethod();
        }).when(numbering).lockSequence(owner.getOrganization().getOrganizationId());
    }

    private void assertUnchanged(Long id) {
        tx.executeWithoutResult(ignored -> {
            Invoice invoice = invoices.findById(id).orElseThrow();
            assertThat(state(id)).isEqualTo("EXPORTABLE");
            assertThat(invoice.getExportBatch()).isNull();
            assertThat(entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(id).orElseThrow()
                    .getExportBatch()).isNull();
            assertThat(entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(id).orElseThrow().getEntryNumber())
                    .isEqualTo("TEMP-" + invoice.getInvoiceNumber());
            assertThat(organizations.findById(owner.getOrganization().getOrganizationId()).orElseThrow()
                    .getNextAccountingPieceNumber()).isEqualTo(1);
            assertThat(batches.findAll().stream().filter(batch -> batch.getOrganization().getOrganizationId()
                    .equals(owner.getOrganization().getOrganizationId()))).isEmpty();
            assertThat(history.findAll().stream().filter(item -> item.getInvoice().getInvoiceId().equals(id))).isEmpty();
        });
    }

    private void assertFailureAudit() {
        tx.executeWithoutResult(ignored -> assertThat(audits.findAll().stream().filter(log -> log.getOrganization()
                .getOrganizationId().equals(owner.getOrganization().getOrganizationId())).toList())
                .singleElement().satisfies(log -> assertThat(log.getNewValue()).contains("result=FAILURE")));
    }

    private org.springframework.test.web.servlet.ResultActions generate(String format, Long... ids) throws Exception {
        return mvc.perform(post(ROOT + "/generate").header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.APPLICATION_JSON).content(body(format, ids)));
    }

    private String body(String format, Long... ids) {
        return "{\"startDate\":\"2042-08-01\",\"endDate\":\"2042-08-31\",\"format\":\"" + format
                + "\",\"invoiceIds\":" + List.of(ids) + "}";
    }

    private String token() { return "Bearer " + jwt.generate(owner); }
    private String state(Long id) { return invoices.findById(id).orElseThrow().getInvoiceStatus().getCode(); }

    private ChartOfAccount account(Organization org, String number) {
        ChartOfAccount account = new ChartOfAccount();
        account.setOrganization(org);
        account.setAccountNumber(number);
        account.setAccountLabel("Account " + number);
        account.setAccountType("GENERAL");
        account.setActive(true);
        return accounts.save(account);
    }

    private Long invoice(String number, ChartOfAccount debit, ChartOfAccount credit, boolean balanced) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(owner.getOrganization());
        invoice.setCreatedByUser(owner);
        invoice.setInvoiceStatus(statuses.findByCode("EXPORTABLE").orElseThrow());
        invoice.setInvoiceNumber(number);
        invoice.setInvoiceDate(LocalDate.of(2042, 8, 15));
        invoice.setCurrencyCode("EUR");
        invoice.setTotalHt(new BigDecimal("100"));
        invoice.setTotalTva(new BigDecimal("20"));
        invoice.setTotalTtc(new BigDecimal("120"));
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        invoices.save(invoice);
        AccountingEntry entry = new AccountingEntry();
        entry.setInvoice(invoice);
        entry.setCreatedByUser(owner);
        entry.setEntryNumber("TEMP-" + number);
        entry.setEntryDate(invoice.getInvoiceDate());
        entry.setLabel(number);
        entry.setStatus("GENERATED");
        entries.save(entry);
        for (int i = 1; i <= 2; i++) {
            AccountingEntryLine line = new AccountingEntryLine();
            line.setAccountingEntry(entry);
            line.setAccount(i == 1 ? debit : credit);
            line.setLineNumber(i);
            line.setLineLabel(number);
            line.setDebitAmount(i == 1 ? new BigDecimal("120") : BigDecimal.ZERO);
            line.setCreditAmount(i == 2 ? new BigDecimal(balanced ? "120" : "119") : BigDecimal.ZERO);
            lines.save(line);
        }
        return invoice.getInvoiceId();
    }
}
