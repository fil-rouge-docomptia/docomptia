package org.facturation.backend.controller;

import com.jayway.jsonpath.JsonPath;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Sql("/accounting-entry-creation/setup.sql")
@Sql(scripts = "/accounting-entry-creation/cleanup.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class AccountingEntryManualCreationIntegrationTest {
    private static final String ROOT = "/api/v1/accounting-entries";
    private static final String LINES = """
            [{"accountId":2,"lineLabel":"Purchase","debitAmount":120,"creditAmount":0,"vatRate":20,"classificationId":910},
             {"accountId":1,"lineLabel":"Supplier","debitAmount":0,"creditAmount":120}]
            """;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenService jwt;
    @Autowired UserRepository users;
    @MockitoSpyBean InvoiceStatusWorkflowService workflow;

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwt.generate(users.findById(1L).orElseThrow()));
    }

    private String body(long invoiceId, long journalId, String lines) {
        return """
                {"invoiceId":%d,"journalId":%d,"entryDate":"2026-09-03","label":" Manual purchase ","lines":%s}
                """.formatted(invoiceId, journalId, lines);
    }

    private MockHttpServletRequestBuilder create(String body) {
        return auth(post(ROOT)).contentType("application/json").content(body);
    }

    private long number(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    private int entryCount() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entries WHERE invoice_id=901", Integer.class);
    }

    private void assertNothingPersisted() {
        assertThat(entryCount()).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action='ACCOUNTING_ENTRY_CREATED' AND entity_name='Invoice' AND entity_id=901", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT invoice_status_id FROM invoices WHERE invoice_id=901", Long.class)).isEqualTo(5L);
    }

    @Test
    void createsPersistsAndAuditsCompleteEntryAndRemovesInvoiceFromCandidates() throws Exception {
        String json = mvc.perform(create(body(901, 910, LINES)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entry.entryNumber").value("EC-901"))
                .andExpect(jsonPath("$.entry.entryDate").value("2026-09-03"))
                .andExpect(jsonPath("$.entry.label").value("Manual purchase"))
                .andExpect(jsonPath("$.entry.status").value("GENERATED"))
                .andExpect(jsonPath("$.entry.version").value(0))
                .andExpect(jsonPath("$.journal.code").value("MAN"))
                .andExpect(jsonPath("$.entry.totalDebit").value("120.00"))
                .andExpect(jsonPath("$.entry.lines[0].vatRate").value("20.00"))
                .andExpect(jsonPath("$.entry.lines[0].classificationId").value(910))
                .andExpect(jsonPath("$.entry.lines[1].vatRate").isEmpty())
                .andExpect(jsonPath("$.invoiceStatus").value("EXPORTABLE"))
                .andExpect(jsonPath("$.exportEligible").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = number(json, "$.entry.accountingEntryId");
        mvc.perform(auth(get(ROOT + "/" + id))).andExpect(status().isOk()).andExpect(content().json(json));
        assertThat(jdbc.queryForObject("SELECT created_by_user_id FROM accounting_entries WHERE accounting_entry_id=?", Long.class, id)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entries WHERE accounting_entry_id=? AND created_at IS NOT NULL AND updated_at IS NOT NULL", Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE entity_name='AccountingEntry' AND entity_id=? AND action='ACCOUNTING_ENTRY_CREATED' AND user_id=1 AND organization_id=1", Integer.class, id)).isEqualTo(6);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE entity_name='AccountingEntryLine' AND action='LINE_ADDED' AND entity_id IN (SELECT accounting_entry_line_id FROM accounting_entry_lines WHERE accounting_entry_id=?)", Integer.class, id)).isEqualTo(18);
        mvc.perform(auth(get("/api/v1/invoices/901/history")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.action == 'ACCOUNTING_ENTRY_CREATED')].type").value("ACCOUNTING_ACTION"))
                .andExpect(jsonPath("$[?(@.action == 'ACCOUNTING_ENTRY_CREATED')].authorId").value(1))
                .andExpect(jsonPath("$[?(@.action == 'ACCOUNTING_ENTRY_CREATED')].newValue").value(Long.toString(id)));
        mvc.perform(auth(get(ROOT + "/creation-candidates").param("query", "MAN-901")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void ignoresClientSuppliedStatusIdentityNumberAndAuditFields() throws Exception {
        String request = body(901, 910, LINES).replace("{\"invoiceId\"", """
                {"accountingEntryId":999,"organizationId":900,"createdByUserId":999,
                 "entryNumber":"FAKE","status":"EXPORTEE","version":99,
                 "createdAt":"2000-01-01T00:00:00","invoiceId"
                """.strip());
        String json = mvc.perform(create(request)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.entry.entryNumber").value("EC-901"))
                .andExpect(jsonPath("$.entry.status").value("GENERATED"))
                .andExpect(jsonPath("$.entry.version").value(0))
                .andExpect(jsonPath("$.invoiceStatus").value("EXPORTABLE"))
                .andReturn().getResponse().getContentAsString();
        long id = number(json, "$.entry.accountingEntryId");
        assertThat(id).isNotEqualTo(999);
        assertThat(jdbc.queryForObject("SELECT created_by_user_id FROM accounting_entries WHERE accounting_entry_id=?", Long.class, id)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entries WHERE accounting_entry_id=? AND created_at > '2000-01-02'", Integer.class, id)).isEqualTo(1);
    }

    @Test
    void acceptsDynamicLineCountAndKeepsFinalNumberSequenceForExport() throws Exception {
        long sequence = jdbc.queryForObject("SELECT next_accounting_piece_number FROM organizations WHERE organization_id=1", Long.class);
        String fourLines = """
                [{"accountId":2,"lineLabel":"A","debitAmount":50,"creditAmount":0},
                 {"accountId":2,"lineLabel":"B","debitAmount":50,"creditAmount":0},
                 {"accountId":3,"lineLabel":"VAT","debitAmount":20,"creditAmount":0},
                 {"accountId":1,"lineLabel":"Supplier","debitAmount":0,"creditAmount":120}]
                """;
        mvc.perform(create(body(901, 910, fourLines))).andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith(ROOT + "/")))
                .andExpect(jsonPath("$.entry.lines.length()").value(4))
                .andExpect(jsonPath("$.entry.lines[3].lineNumber").value(4));
        assertThat(jdbc.queryForObject("SELECT next_accounting_piece_number FROM organizations WHERE organization_id=1", Long.class)).isEqualTo(sequence);
    }

    @Test
    void savesUnbalancedProposalAndAllowsExistingLineApiToCompleteIt() throws Exception {
        String json = mvc.perform(create(body(901, 910, LINES.replace("\"debitAmount\":120", "\"debitAmount\":100"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.entry.balanced").value(false))
                .andExpect(jsonPath("$.invoiceStatus").value("VALIDEE"))
                .andExpect(jsonPath("$.exportEligible").value(false)).andExpect(jsonPath("$.needsAttention").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = number(json, "$.entry.accountingEntryId");
        long lineId = number(json, "$.entry.lines[0].accountingEntryLineId");
        mvc.perform(auth(patch(ROOT + "/" + id + "/lines/" + lineId))
                        .header("If-Match", "\"0\"").header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType("application/json").content("{\"debitAmount\":120}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.exportEligible").value(true));
    }

    @Test
    void repeatSubmissionReturnsAuthorizedExistingEntryWithoutOverwritingIt() throws Exception {
        String json = mvc.perform(create(body(901, 910, LINES))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = number(json, "$.entry.accountingEntryId");
        int auditCount = jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs", Integer.class);
        mvc.perform(create(body(901, 910, LINES).replace("Manual purchase", "Different")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ACCOUNTING_ENTRY_ALREADY_EXISTS"))
                .andExpect(jsonPath("$.accountingEntryId").value(id)).andExpect(jsonPath("$.entryUrl").value(ROOT + "/" + id));
        assertThat(entryCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs", Integer.class)).isEqualTo(auditCount);
        assertThat(jdbc.queryForObject("SELECT label FROM accounting_entries WHERE accounting_entry_id=?", String.class, id)).isEqualTo("Manual purchase");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"accountId\":999,\"lineLabel\":\"Bad\",\"debitAmount\":1,\"creditAmount\":0}",
            "{\"accountId\":910,\"lineLabel\":\"Bad\",\"debitAmount\":1,\"creditAmount\":0}",
            "{\"accountId\":911,\"lineLabel\":\"Bad\",\"debitAmount\":1,\"creditAmount\":0}",
            "{\"accountId\":2,\"lineLabel\":\"Bad\",\"debitAmount\":-1,\"creditAmount\":0}",
            "{\"accountId\":2,\"lineLabel\":\"Bad\",\"debitAmount\":1.001,\"creditAmount\":0}",
            "{\"accountId\":2,\"lineLabel\":\"Bad\",\"debitAmount\":1,\"creditAmount\":1}", "null"})
    void invalidLaterLineLeavesNoPartialEntry(String invalidLine) throws Exception {
        String lines = LINES.trim().substring(0, LINES.trim().length() - 1) + "," + invalidLine + "]";
        mvc.perform(create(body(901, 910, lines))).andExpect(status().isBadRequest());
        assertNothingPersisted();
    }

    @ParameterizedTest
    @ValueSource(longs = {911, 912, 999})
    void refusesInactiveForeignOrMissingJournal(long journalId) throws Exception {
        mvc.perform(create(body(901, journalId, LINES))).andExpect(status().isBadRequest());
        assertNothingPersisted();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"invoiceId\":901}",
            "{\"invoiceId\":901,\"journalId\":910,\"entryDate\":\"2026-09-03\",\"label\":\"Valid\",\"lines\":[]}",
            "{\"invoiceId\":901,\"journalId\":910,\"entryDate\":\"2026-02-30\",\"label\":\"Valid\",\"lines\":[]}"})
    void requiresValidHeaderAndNonemptyLines(String body) throws Exception {
        mvc.perform(create(body)).andExpect(status().isBadRequest());
        assertNothingPersisted();
    }

    @ParameterizedTest
    @ValueSource(ints = {8, 9, 10, 11, 12})
    void refusesIneligibleWorkflowStates(int statusId) throws Exception {
        jdbc.update("UPDATE invoices SET invoice_status_id=? WHERE invoice_id=901", statusId);
        mvc.perform(create(body(901, 910, LINES))).andExpect(status().isConflict());
        assertThat(entryCount()).isZero();
    }

    @Test
    void refusesCustomerInvoicesMissingSuppliersAndPendingDuplicates() throws Exception {
        for (long id : List.of(904L, 905L)) {
            mvc.perform(create(body(id, 910, LINES))).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("ACCOUNTING_ENTRY_CREATION_NOT_ALLOWED"));
        }
        jdbc.update("INSERT INTO invoice_duplicate_alerts (invoice_id,matching_invoice_id,supplier_id,alert_type,decision,created_at) VALUES (901,906,1,'PROBABLE','PENDING',CURRENT_TIMESTAMP)");
        mvc.perform(create(body(901, 910, LINES))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ALERT_ACTION_NOT_ALLOWED"));
        mvc.perform(auth(get(ROOT + "/creation-candidates").param("query", "MAN-901")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        assertNothingPersisted();
    }

    @Test
    void enforcesAuthenticationPermissionsAndOrganizationIsolation() throws Exception {
        mvc.perform(post(ROOT).contentType("application/json").content(body(901, 910, LINES))).andExpect(status().isUnauthorized());
        mvc.perform(post(ROOT).with(user("test").roles("UNKNOWN")).contentType("application/json").content(body(901, 910, LINES))).andExpect(status().isForbidden());
        mvc.perform(get(ROOT + "/creation-candidates")).andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT + "/creation-candidates").with(user("test").roles("UNKNOWN"))).andExpect(status().isForbidden());
        for (long id : List.of(902L, 999L)) {
            mvc.perform(create(body(id, 910, LINES))).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.accountingEntryId").doesNotExist()).andExpect(jsonPath("$.entryUrl").doesNotExist());
        }
        assertNothingPersisted();
    }

    @Test
    void filtersCandidatesBeforePaginationAndValidatesPageParameters() throws Exception {
        mvc.perform(auth(get(ROOT + "/creation-candidates").param("query", "man").param("size", "1")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].invoiceId").value(906));
        mvc.perform(auth(get(ROOT + "/creation-candidates").param("query", " ORANGE ").param("size", "1").param("page", "1")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].invoiceId").value(901));
        mvc.perform(auth(get(ROOT + "/creation-candidates").param("query", "SECRET")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(auth(get(ROOT + "/creation-candidates").param("page", "-1"))).andExpect(status().isBadRequest());
        mvc.perform(auth(get(ROOT + "/creation-candidates").param("size", "101"))).andExpect(status().isBadRequest());
    }

    @Test
    void rollsBackEntryLinesAuditsAndStatusWhenFailureOccursAfterPersistence() {
        int audits = jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs", Integer.class);
        int lines = jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entry_lines", Integer.class);
        doThrow(new IllegalStateException("Simulated workflow failure")).when(workflow).markExportable(any(), any());
        assertThatThrownBy(() -> mvc.perform(create(body(901, 910, LINES))))
                .hasRootCauseMessage("Simulated workflow failure");
        assertNothingPersisted();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs", Integer.class)).isEqualTo(audits);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entry_lines", Integer.class)).isEqualTo(lines);
    }

    @Test
    void concurrentManualSubmissionsCreateOnlyOneOriginal() throws Exception {
        List<MvcResult> results = race(create(body(901, 910, LINES)), create(body(901, 910, LINES)));
        assertThat(results.stream().map(result -> result.getResponse().getStatus()).toList()).containsExactlyInAnyOrder(201, 409);
        assertThat(entryCount()).isEqualTo(1);
        long createdId = number(results.stream().filter(r -> r.getResponse().getStatus() == 201).findFirst().orElseThrow().getResponse().getContentAsString(), "$.entry.accountingEntryId");
        long existingId = number(results.stream().filter(r -> r.getResponse().getStatus() == 409).findFirst().orElseThrow().getResponse().getContentAsString(), "$.accountingEntryId");
        assertThat(existingId).isEqualTo(createdId);
    }

    @Test
    void concurrentManualAndAutomaticGenerationShareOneOriginal() throws Exception {
        List<MvcResult> results = race(create(body(901, 910, LINES)), auth(post("/api/v1/invoices/901/accounting-entry")));
        assertThat(results.get(1).getResponse().getStatus()).isEqualTo(200);
        int manualStatus = results.getFirst().getResponse().getStatus();
        assertThat(manualStatus).isIn(201, 409);
        long manualId = number(results.getFirst().getResponse().getContentAsString(), manualStatus == 201 ? "$.entry.accountingEntryId" : "$.accountingEntryId");
        long automaticId = number(results.get(1).getResponse().getContentAsString(), "$.accountingEntry.accountingEntryId");
        assertThat(manualId).isEqualTo(automaticId);
        assertThat(entryCount()).isEqualTo(1);
    }

    private List<MvcResult> race(MockHttpServletRequestBuilder first, MockHttpServletRequestBuilder second) throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var futures = List.of(first, second).stream().map(request -> executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start barrier timeout");
                return mvc.perform(request).andReturn();
            })).toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(futures.getFirst().get(20, TimeUnit.SECONDS), futures.get(1).get(20, TimeUnit.SECONDS));
        }
    }
}
