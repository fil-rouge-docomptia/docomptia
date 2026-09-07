package org.facturation.backend.controller;

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
    @CsvSource({"page,-1", "size,0", "size,101", "status,UNKNOWN", "balanced,invalid"})
    void validatesQueryParameters(String name, String value) throws Exception {
        mockMvc.perform(authenticatedGet("/api/v1/accounting-entries").param(name, value)).andExpect(status().isBadRequest());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/accounting-entries")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/accounting-entries/901")).andExpect(status().isUnauthorized());
    }
}
