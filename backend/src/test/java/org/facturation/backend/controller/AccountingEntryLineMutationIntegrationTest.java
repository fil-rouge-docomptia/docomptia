package org.facturation.backend.controller;

import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import org.facturation.backend.service.JwtTokenService;
import org.facturation.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "INSERT INTO organizations (organization_id,name,legal_name,siret,email,validation_required) VALUES (900,'Other','Other','90000000000000','other@example.com',true)",
        "INSERT INTO invoices (invoice_id,organization_id,invoice_status_id,created_by_user_id,invoice_number,currency_code,total_ht,total_tva,total_ttc) VALUES (901,1,9,1,'INV-901','EUR',100,20,120),(902,900,9,1,'SECRET','USD',100,20,120)",
        "INSERT INTO accounting_entries (accounting_entry_id,invoice_id,created_by_user_id,entry_number,entry_date,label,status) VALUES (901,901,1,'ACC-901','2026-09-01','Purchase','GENERATED'),(902,902,1,'SECRET','2026-09-01','Hidden','GENERATED')",
        "INSERT INTO accounting_entry_lines (accounting_entry_line_id,accounting_entry_id,account_id,line_number,line_label,debit_amount,credit_amount) VALUES (901,901,1,1,'Debit',120,0),(902,901,1,2,'Credit',0,120),(903,902,1,1,'Hidden',120,0)",
        "INSERT INTO classifications (classification_id,organization_id,classification_type,name,active) VALUES (910,1,'CHANTIER','Site',true),(911,1,'DOSSIER','Inactive',false),(912,900,'CHANTIER','Secret',true)"
})
class AccountingEntryLineMutationIntegrationTest {
    private static final String ROOT = "/api/v1/accounting-entries/901/lines";
    private static final String BODY = "{\"accountId\":1,\"lineLabel\":\"Extra\",\"debitAmount\":5,\"creditAmount\":0,\"vatRate\":20,\"classificationId\":910}";
    @Autowired MockMvc mvc;
    @Autowired JwtTokenService jwt;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entityManager;

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwt.generate(users.findById(1L).orElseThrow()));
    }

    private MockHttpServletRequestBuilder mutation(MockHttpServletRequestBuilder request, long version, String key) {
        return auth(request).header("If-Match", "\"" + version + "\"").header("Idempotency-Key", key);
    }

    @Test
    void persistsAddsPatchesClearsAndDeletesWithReplayAndRecomputedDiagnostics() throws Exception {
        String addKey = UUID.randomUUID().toString();
        String json = mvc.perform(mutation(post(ROOT), 0, addKey).contentType("application/json").content(BODY))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.lines.length()").value(3)).andExpect(jsonPath("$.totalDebit").value("125.00"))
                .andExpect(jsonPath("$.balanced").value(false)).andExpect(jsonPath("$.exportEligible").value(false))
                .andExpect(jsonPath("$.lines[2].vatRate").value("20.00"))
                .andExpect(jsonPath("$.lines[2].classificationType").value("CHANTIER"))
                .andReturn().getResponse().getContentAsString();
        long addedId = ((Number) JsonPath.read(json, "$.lines[2].accountingEntryLineId")).longValue();
        assertThat(jdbc.queryForObject("SELECT invoice_status_id FROM invoices WHERE invoice_id=901", Long.class)).isEqualTo(5L);
        String patchKey = UUID.randomUUID().toString();
        String patchBody = "{\"vatRate\":null,\"classificationId\":null}";
        mvc.perform(mutation(patch(ROOT + "/" + addedId), 1, patchKey).contentType("application/json").content(patchBody))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.lines[2].vatRate").isEmpty()).andExpect(jsonPath("$.lines[2].classificationId").isEmpty());
        mvc.perform(mutation(patch(ROOT + "/" + addedId), 1, patchKey).contentType("application/json").content(patchBody))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(2));
        entityManager.clear();
        mvc.perform(auth(get("/api/v1/accounting-entries/901")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entry.lines[2].vatRate").isEmpty());
        String removeKey = UUID.randomUUID().toString();
        for (int retry = 0; retry < 2; retry++) {
            mvc.perform(mutation(delete(ROOT + "/" + addedId), 2, removeKey))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(3))
                    .andExpect(jsonPath("$.lines.length()").value(2)).andExpect(jsonPath("$.balanced").value(true))
                    .andExpect(jsonPath("$.exportEligible").value(true));
        }
        // A lost response retried after later edits returns current state without resurrecting the deleted line.
        mvc.perform(mutation(post(ROOT), 0, addKey).contentType("application/json").content(BODY))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.lines.length()").value(2));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entry_mutations", Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action='LINE_ADDED' AND entity_id=?", Integer.class, addedId)).isEqualTo(9);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action='LINE_REMOVED' AND entity_id=?", Integer.class, addedId)).isEqualTo(9);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE entity_id=? AND (user_id<>1 OR organization_id<>1)", Integer.class, addedId)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"accountId\":999}", "{\"lineLabel\":\" \"}", "{\"debitAmount\":-1}", "{\"debitAmount\":1.001}",
        "{\"debitAmount\":10000000000}", "{\"creditAmount\":1}", "{\"vatRate\":100.01}", "{\"vatRate\":-1}",
        "{\"vatRate\":2.123}", "{\"classificationId\":911}", "{\"classificationId\":912}", "{\"classificationId\":999}"
    })
    void rejectsInvalidEditsWithoutPersistingAnyFieldOrAudit(String body) throws Exception {
        mvc.perform(mutation(patch(ROOT + "/901"), 0, UUID.randomUUID().toString()).contentType("application/json").content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("ACCOUNTING_ENTRY_LINE_VALIDATION_ERROR"));
        assertThat(jdbc.queryForObject("SELECT version FROM accounting_entries WHERE accounting_entry_id=901", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entry_mutations", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action='LINE_CORRECTION'", Integer.class)).isZero();
    }

    @Test
    void zeroDraftAndEmptyEntryStayCorrectableButNotExportable() throws Exception {
        mvc.perform(mutation(patch(ROOT + "/901"), 0, UUID.randomUUID().toString())
                        .contentType("application/json").content("{\"debitAmount\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.exportEligible").value(false))
                .andExpect(jsonPath("$.diagnostics[*].code", hasItem("ACCOUNTING_LINE_AMOUNT_MISSING")));
        mvc.perform(mutation(delete(ROOT + "/901"), 1, UUID.randomUUID().toString())).andExpect(status().isOk());
        mvc.perform(mutation(delete(ROOT + "/902"), 2, UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.lines.length()").value(0))
                .andExpect(jsonPath("$.balanced").value(true)).andExpect(jsonPath("$.exportEligible").value(false))
                .andExpect(jsonPath("$.diagnostics[*].code", hasItem("ACCOUNTING_LINES_MISSING")));
        mvc.perform(mutation(post(ROOT), 3, UUID.randomUUID().toString()).contentType("application/json").content(BODY))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.lines.length()").value(1));
    }

    @Test
    void preservesOmittedMetadataAndRejectsStaleVersionOrChangedRetryPayload() throws Exception {
        String key = UUID.randomUUID().toString();
        mvc.perform(mutation(patch(ROOT + "/901"), 0, key).contentType("application/json")
                        .content("{\"vatRate\":5.5,\"classificationId\":910}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mvc.perform(auth(patch(ROOT + "/901")).contentType("application/json").content("{\"lineLabel\":\"Renamed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.lines[0].vatRate").value("5.50"))
                .andExpect(jsonPath("$.lines[0].classificationId").value(910));
        mvc.perform(mutation(patch(ROOT + "/901"), 0, key).contentType("application/json").content("{\"vatRate\":10}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ACCOUNTING_ENTRY_MUTATION_CONFLICT"));
    }

    @Test
    void distinguishesNullFromLiteralNullInIdempotencyFingerprints() throws Exception {
        String key = UUID.randomUUID().toString();
        mvc.perform(mutation(patch(ROOT + "/901"), 0, key).contentType("application/json")
                        .content("{\"lineLabel\":null,\"debitAmount\":119}"))
                .andExpect(status().isOk());
        mvc.perform(mutation(patch(ROOT + "/901"), 0, key).contentType("application/json")
                        .content("{\"lineLabel\":\"null\",\"debitAmount\":119}"))
                .andExpect(status().isConflict());
    }

    @Test
    void requiresRealPermissionsAndHeadersAndHidesForeignEntriesAndLines() throws Exception {
        mvc.perform(post(ROOT).contentType("application/json").content(BODY)).andExpect(status().isUnauthorized());
        mvc.perform(delete(ROOT + "/901").with(user("test").roles("UNKNOWN"))).andExpect(status().isForbidden());
        mvc.perform(auth(post(ROOT)).contentType("application/json").content(BODY)).andExpect(status().isBadRequest());
        mvc.perform(mutation(post(ROOT), 0, "bad-key").contentType("application/json").content(BODY)).andExpect(status().isBadRequest());
        mvc.perform(auth(patch(ROOT + "/901")).header("If-Match", "*")
                .contentType("application/json").content("{\"lineLabel\":\"Change\"}")).andExpect(status().isBadRequest());
        mvc.perform(mutation(delete(ROOT + "/903"), 0, UUID.randomUUID().toString())).andExpect(status().isNotFound());
        mvc.perform(mutation(post("/api/v1/accounting-entries/902/lines"), 0, UUID.randomUUID().toString())
                .contentType("application/json").content(BODY)).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(strings = {"REVERSAL", "EXPORTED", "ARCHIVED", "PAID", "BATCH"})
    void protectsImmutableEntries(String state) throws Exception {
        if (state.equals("REVERSAL")) jdbc.update("UPDATE accounting_entries SET status='REVERSAL' WHERE accounting_entry_id=901");
        else if (state.equals("BATCH")) {
            jdbc.update("INSERT INTO export_batches (export_batch_id,organization_id,created_by_user_id,format,status) VALUES (910,1,1,'CSV','PREPARATION')");
            jdbc.update("UPDATE accounting_entries SET export_batch_id=910 WHERE accounting_entry_id=901");
        } else jdbc.update("UPDATE invoices SET invoice_status_id=? WHERE invoice_id=901", state.equals("EXPORTED") ? 10 : state.equals("PAID") ? 12 : 11);
        mvc.perform(mutation(delete(ROOT + "/901"), 0, UUID.randomUUID().toString())).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entry_lines WHERE accounting_entry_id=901", Integer.class)).isEqualTo(2);
    }

    @Test
    void editsCorrectiveIndependentlyOfExportedOriginalAndCopiesExplicitMetadata() throws Exception {
        jdbc.update("UPDATE accounting_entry_lines SET vat_rate=20, classification_id=910 WHERE accounting_entry_id=901");
        jdbc.update("UPDATE invoices SET invoice_status_id=10 WHERE invoice_id=901");
        String created = mvc.perform(auth(post("/api/v1/accounting-entries/901/corrective-entry")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.lines[0].vatRate").value("20.00"))
                .andReturn().getResponse().getContentAsString();
        long entryId = ((Number) JsonPath.read(created, "$.accountingEntryId")).longValue();
        long lineId = ((Number) JsonPath.read(created, "$.lines[0].accountingEntryLineId")).longValue();
        mvc.perform(mutation(patch("/api/v1/accounting-entries/" + entryId + "/lines/" + lineId), 0, UUID.randomUUID().toString())
                        .contentType("application/json").content("{\"debitAmount\":119,\"vatRate\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CORRECTIVE"))
                .andExpect(jsonPath("$.balanced").value(false)).andExpect(jsonPath("$.exportEligible").value(false));
        assertThat(jdbc.queryForObject("SELECT debit_amount FROM accounting_entry_lines WHERE accounting_entry_line_id=901", java.math.BigDecimal.class)).isEqualByComparingTo("120");
        assertThat(jdbc.queryForObject("SELECT invoice_status_id FROM invoices WHERE invoice_id=901", Long.class)).isEqualTo(10L);
    }
}
