package org.facturation.backend.controller;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.facturation.backend.service.JwtTokenService;
import org.facturation.backend.repository.UserRepository;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "INSERT INTO organizations (organization_id, name, legal_name, siret, email, validation_required) VALUES (900, 'Other', 'Other SAS', '90000000000000', 'other@example.com', true)",
        "INSERT INTO invoices (invoice_id, organization_id, invoice_status_id, created_by_user_id, invoice_number, currency_code) VALUES (901, 1, 10, 1, 'INV-901', 'EUR'), (902, 900, 5, 1, 'SECRET', 'USD')",
        "INSERT INTO accounting_entries (accounting_entry_id, invoice_id, created_by_user_id, entry_number, entry_date, label, status, reversed_accounting_entry_id) VALUES (901, 901, 1, 'ACC-901', '2026-09-01', 'Purchase', 'GENERATED', null), (902, 901, 1, 'ACC-902', '2026-09-02', 'Adjustment', 'CORRECTIVE', null), (903, 901, 1, 'ACC-903', '2026-09-02', 'Reversal', 'REVERSAL', 901), (904, 902, 1, 'SECRET', '2026-09-03', 'Hidden', 'GENERATED', null)",
        "INSERT INTO accounting_entry_lines (accounting_entry_line_id, accounting_entry_id, account_id, line_number, debit_amount, credit_amount) VALUES (901, 901, 1, 1, 120.00, 0.00), (902, 901, 1, 2, 0.00, 120.00), (903, 902, 1, 1, 119.99, 120.00), (904, 903, 1, 1, 0.00, 120.00), (905, 903, 1, 2, 120.00, 0.00)"
})
class AccountingEntryReadIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService tokens;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private EntityManager entityManager;

    private MockHttpServletRequestBuilder authenticatedGet(String path, Object... args) {
        return get(path, args).header("Authorization", "Bearer " + tokens.generate(users.findById(1L).orElseThrow()));
    }

    @Test
    void paginatesOnlyTheCurrentOrganizationInDeterministicOrder() throws Exception {
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("size", "2").param("organizationId", "900"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].entry.accountingEntryId").value(903))
                .andExpect(jsonPath("$.content[1].entry.accountingEntryId").value(902));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("size", "2").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].entry.accountingEntryId").value(901));
    }

    @Test
    void combinesSearchStatusAndBalanceBeforePagination() throws Exception {
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("query", " ADJUST ")
                        .param("balanced", "false").param("status", "CORRECTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].entry.totalDebit").value("119.99"))
                .andExpect(jsonPath("$.content[0].entry.totalCredit").value("120.00"))
                .andExpect(jsonPath("$.content[0].entry.balanceDifference").value("0.01"));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("balanced", "true").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void returnsExactReversalDetailsAndDoesNotConfuseInvoiceStatusWithEntryStatus() throws Exception {
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries/903"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(901))
                .andExpect(jsonPath("$.invoiceStatus").value("EXPORTEE"))
                .andExpect(jsonPath("$.currencyCode").value("EUR"))
                .andExpect(jsonPath("$.entry.status").value("REVERSAL"))
                .andExpect(jsonPath("$.entry.reversedAccountingEntryId").value(901))
                .andExpect(jsonPath("$.entry.totalDebit").value("120.00"))
                .andExpect(jsonPath("$.entry.balanced").value(true))
                .andExpect(jsonPath("$.entry.lines[0].creditAmount").value("120.00"));
    }

    @Test
    void refusesForeignAndMissingEntries() throws Exception {
        for (long id : new long[]{904, 99999}) {
            mockMvc.perform(authenticatedGet("/api/v1/accounting-entries/{id}", id))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("ACCOUNTING_ENTRY_NOT_FOUND"));
        }
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("query", "SECRET"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void handlesEmptyPagesAndLiteralSearchCharacters() throws Exception {
        for (String query : new String[]{"missing", "%", "_"}) {
            mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("query", query))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        }
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("page", "99"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("query", "inv-901"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3));
    }

    @ParameterizedTest
    @CsvSource({"page,-1", "size,0", "size,101", "status,UNKNOWN", "balanced,invalid",
            "journalId,0", "journalId,-1", "exportStatus,UNKNOWN", "startDate,invalid",
            "sortBy,totalDebit", "sortBy,entry.label desc", "direction,invalid"})
    void validatesQueryParameters(String name, String value) throws Exception {
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param(name, value)).andExpect(status().isBadRequest());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/accounting-entries")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/accounting-entries/901")).andExpect(status().isUnauthorized());
    }

    @Test
    void filtersPeriodJournalAndEntryExportBeforePagination() throws Exception {
        addJournalsAndBatch();
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries")
                        .param("startDate", "2026-09-01").param("endDate", "2026-09-02")
                        .param("journalId", "910").param("exportStatus", "NOT_EXPORTED")
                        .param("query", "INV-901").param("status", "CORRECTIVE")
                        .param("balanced", "false").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].entry.accountingEntryId").value(902))
                .andExpect(jsonPath("$.content[0].journal.code").value("PURCHASES"));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries")
                        .param("startDate", "2026-09-01").param("endDate", "2026-09-01")
                        .param("exportStatus", "EXPORTED").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].entry.accountingEntryId").value(901));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries")
                        .param("journalId", "912"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries")
                        .param("startDate", "2026-09-02").param("endDate", "2026-09-01"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exportEvidenceBelongsToTheEntryAndSurvivesBatchArchival() throws Exception {
        addJournalsAndBatch();
        jdbc.update("UPDATE export_batches SET status = 'ARCHIVE' WHERE export_batch_id = 910");
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries/901"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.exportStatus").value("EXPORTED"))
                .andExpect(jsonPath("$.exportBatchId").value(910))
                .andExpect(jsonPath("$.exportedAt").value("2026-09-03T10:00:00"))
                .andExpect(jsonPath("$.exportEligible").value(false));
        for (int id : new int[]{902, 903}) {
            mockMvc.perform(authenticatedGet("/api/v1/accounting-entries/{id}", id))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.invoiceStatus").value("EXPORTEE"))
                    .andExpect(jsonPath("$.exportStatus").value("NOT_EXPORTED"))
                    .andExpect(jsonPath("$.exportBatchId").isEmpty())
                    .andExpect(jsonPath("$.exportedAt").isEmpty())
                    .andExpect(jsonPath("$.exportEligible").value(false))
                    .andExpect(jsonPath("$.diagnostics[*].code", hasItem("ENTRY_EXPORT_WORKFLOW_UNAVAILABLE")));
        }
        jdbc.update("UPDATE export_batches SET status = 'PREPARATION' WHERE export_batch_id = 910");
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("exportStatus", "EXPORTED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void diagnosesActualLinesWithoutInventingAJournalOrABalanceCulprit() throws Exception {
        jdbc.update("UPDATE invoices SET total_ht=100, total_tva=20, total_ttc=120, invoice_status_id=9 WHERE invoice_id=901");
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries/901"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.journal").isEmpty())
                .andExpect(jsonPath("$.entry.balanced").value(true))
                .andExpect(jsonPath("$.exportEligible").value(true))
                .andExpect(jsonPath("$.needsAttention").value(false))
                .andExpect(jsonPath("$.diagnostics[0].code").value("JOURNAL_NOT_ASSIGNED"))
                .andExpect(jsonPath("$.diagnostics[0].blocking").value(false));
        jdbc.update("UPDATE chart_of_accounts SET is_active=false WHERE account_id=1");
        entityManager.clear();
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries/901"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entry.balanced").value(true))
                .andExpect(jsonPath("$.exportEligible").value(false))
                .andExpect(jsonPath("$.needsAttention").value(true))
                .andExpect(jsonPath("$.diagnostics[0].code").value("ACCOUNT_INACTIVE"))
                .andExpect(jsonPath("$.diagnostics[0].accountingEntryLineId").value(901));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries/902"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diagnostics[0].code").value("ACCOUNTING_ENTRY_UNBALANCED"))
                .andExpect(jsonPath("$.diagnostics[0].accountingEntryLineId").isEmpty());
    }

    @Test
    void sortsSupportedColumnsBeforePaginationAndRetainsMissingAssociations() throws Exception {
        addJournalsAndBatch();
        for (String sort : new String[]{"entryDate", "entryNumber", "invoiceNumber", "supplierName", "journalCode"}) {
            mockMvc.perform(authenticatedGet("/api/v1/accounting-entries")
                            .param("sortBy", sort).param("direction", "ASC").param("size", "1"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3));
        }
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries")
                        .param("sortBy", "entryNumber").param("direction", "ASC").param("size", "1").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].entry.accountingEntryId").value(902));
    }

    @Test
    void hidesInconsistentForeignReferencesAndBlocksTheirExport() throws Exception {
        addJournalsAndBatch();
        jdbc.update("UPDATE accounting_entries SET accounting_journal_id=912 WHERE accounting_entry_id=901");
        jdbc.update("UPDATE export_batches SET organization_id=900 WHERE export_batch_id=910");
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries/901"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.journal").isEmpty())
                .andExpect(jsonPath("$.exportBatchId").isEmpty())
                .andExpect(jsonPath("$.exportStatus").value("NOT_EXPORTED"))
                .andExpect(jsonPath("$.exportEligible").value(false))
                .andExpect(jsonPath("$.needsAttention").value(true))
                .andExpect(jsonPath("$.diagnostics[*].code", hasItem("JOURNAL_OUTSIDE_ORGANIZATION")))
                .andExpect(jsonPath("$.diagnostics[*].code", hasItem("EXPORT_BATCH_OUTSIDE_ORGANIZATION")));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("exportStatus", "EXPORTED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param("exportStatus", "NOT_EXPORTED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void listsOnlyRealOrganizationJournalsIncludingInactiveHistory() throws Exception {
        mockMvc.perform(authenticatedGet("/api/v1/accounting-journals"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        addJournalsAndBatch();
        mockMvc.perform(authenticatedGet("/api/v1/accounting-journals")
                        .param("organizationId", "900").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].code").value("OLD"))
                .andExpect(jsonPath("$.content[0].active").value(false));
        mockMvc.perform(get("/api/v1/accounting-journals")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/accounting-journals").with(user("test").roles("UNKNOWN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/accounting-entries").with(user("test").roles("UNKNOWN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(authenticatedGet("/api/v1/accounting-journals").param("size", "101"))
                .andExpect(status().isBadRequest());
    }

    private void addJournalsAndBatch() {
        jdbc.update("INSERT INTO accounting_journals (accounting_journal_id, organization_id, code, label, active) VALUES "
                + "(910, 1, 'PURCHASES', 'Purchases', true), (911, 1, 'OLD', 'Historical', false), (912, 900, 'SECRET', 'Hidden', true)");
        jdbc.update("INSERT INTO export_batches (export_batch_id, organization_id, created_by_user_id, format, status, generated_at) "
                + "VALUES (910, 1, 1, 'CSV', 'GENERE', '2026-09-03 10:00:00')");
        jdbc.update("UPDATE accounting_entries SET accounting_journal_id=910 WHERE accounting_entry_id IN (901,902)");
        jdbc.update("UPDATE accounting_entries SET export_batch_id=910 WHERE accounting_entry_id=901");
        jdbc.update("UPDATE invoices SET export_batch_id=910 WHERE invoice_id=901");
    }
}
