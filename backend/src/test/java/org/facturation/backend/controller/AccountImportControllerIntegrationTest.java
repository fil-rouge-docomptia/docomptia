package org.facturation.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Sql(statements = {
        "DELETE FROM audit_logs WHERE action = 'CSV_IMPORT'",
        "DELETE FROM chart_of_accounts WHERE account_id >= 1000",
        "ALTER TABLE chart_of_accounts ALTER COLUMN account_id RESTART WITH 1000"
})
class AccountImportControllerIntegrationTest {
    private static final String MAPPING = "{\"accountNumber\":0,\"accountLabel\":1,\"accountType\":2,\"active\":3}";
    private static final String CSV = "number,label,type,active\n001ABC, New label ,CUSTOM,false\n401000,Existing,PASSIF,true\n001ABC,Duplicate,CUSTOM,true\n,Missing,CHARGE,maybe\n";
    @Autowired private MockMvc mvc;
    @MockitoSpyBean private ChartOfAccountRepository accounts;
    @Autowired private AuditLogRepository auditLogs;

    @Test
    void inspectionAndPreviewDoNotWriteAndExposeRealRows() throws Exception {
        long count = accounts.count();
        mvc.perform(request("inspect", CSV, null)).andExpect(status().isOk())
                .andExpect(jsonPath("$.columns[0]").value("number"))
                .andExpect(jsonPath("$.totalRows").value(4))
                .andExpect(jsonPath("$.sampleRows[0][0]").value("001ABC"));
        mvc.perform(request("preview", CSV, MAPPING)).andExpect(status().isOk())
                .andExpect(jsonPath("$.newAccounts").value(1))
                .andExpect(jsonPath("$.existingAccounts").value(1))
                .andExpect(jsonPath("$.duplicateAccounts").value(1))
                .andExpect(jsonPath("$.invalidRows").value(1))
                .andExpect(jsonPath("$.rows[0].accountLabel").value("New label"))
                .andExpect(jsonPath("$.rows[3].lineNumber").value(5))
                .andExpect(jsonPath("$.rows[3].errors.length()").value(2));
        assertEquals(count, accounts.count());
    }

    @Test
    void confirmsOnlyNewValidRowsPreservesReferencesAndReplaysWithoutDuplicates() throws Exception {
        String fingerprint = preview(CSV, MAPPING);
        mvc.perform(request("confirm", CSV, MAPPING).param("fingerprint", fingerprint))
                .andExpect(status().isBadRequest());
        mvc.perform(request("confirm", CSV, MAPPING).param("fingerprint", fingerprint).param("excludeInvalidRows", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imported").value(1))
                .andExpect(jsonPath("$.rows[0].status").value("IMPORTED"))
                .andExpect(jsonPath("$.importedByUserId").value(1))
                .andExpect(jsonPath("$.importedAt").isNotEmpty());
        var imported = accounts.findByOrganizationOrganizationId(1L, org.springframework.data.domain.Pageable.unpaged())
                .stream().filter(a -> a.getAccountNumber().equals("001ABC")).findFirst().orElseThrow();
        assertFalse(imported.isActive());
        assertEquals("CUSTOM", imported.getAccountType());
        assertEquals("Fournisseurs", accounts.findById(1L).orElseThrow().getAccountLabel());
        assertTrue(auditLogs.findAll().stream().anyMatch(log -> "CSV_IMPORT".equals(log.getAction())));
        mvc.perform(request("confirm", CSV, MAPPING).param("fingerprint", fingerprint).param("excludeInvalidRows", "true"))
                .andExpect(status().isConflict());
        mvc.perform(request("confirm", CSV, MAPPING).param("fingerprint", preview(CSV, MAPPING)).param("excludeInvalidRows", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imported").value(0));
        assertEquals(5, accounts.count());
    }

    @Test
    void rejectsChangedFileAndMappingBeforeAnyWrite() throws Exception {
        String fingerprint = preview(CSV, MAPPING);
        mvc.perform(request("confirm", CSV.replace("New label", "Changed label"), MAPPING).param("fingerprint", fingerprint).param("excludeInvalidRows", "true"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ACCOUNT_IMPORT_PREVIEW_CHANGED"));
        mvc.perform(request("confirm", CSV, MAPPING.replace("\"accountNumber\":0", "\"accountNumber\":1").replace("\"accountLabel\":1", "\"accountLabel\":0"))
                        .param("fingerprint", fingerprint).param("excludeInvalidRows", "true"))
                .andExpect(status().isConflict());
        assertEquals(4, accounts.count());
    }

    @Test
    void defaultsUnmappedActiveToTrueAndDoesNotInventMissingTypes() throws Exception {
        String mapping = "{\"accountNumber\":0,\"accountLabel\":1,\"accountType\":2}";
        String csv = "number,label,type\n0001,Label,CUSTOM\n0002,Missing type,\n0003,Short\n";
        mvc.perform(request("preview", csv, mapping)).andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].active").value(true))
                .andExpect(jsonPath("$.invalidRows").value(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"accountNumber\":0,\"accountLabel\":1}",
            "{\"accountNumber\":0,\"accountLabel\":0,\"accountType\":2}",
            "{\"accountNumber\":-1,\"accountLabel\":1,\"accountType\":2}",
            "{\"accountNumber\":0,\"accountLabel\":1,\"accountType\":99}"})
    void rejectsIncompleteDuplicatedOrOutOfRangeMappings(String mapping) throws Exception {
        mvc.perform(request("preview", CSV, mapping)).andExpect(status().isBadRequest());
    }

    @Test
    void rollsBackAllCreatedAccountsOnConcurrentConstraintFailure() throws Exception {
        String fingerprint = preview(CSV, MAPPING);
        doAnswer(invocation -> {
            List<ChartOfAccount> created = invocation.getArgument(0);
            accounts.saveAndFlush(created.getFirst());
            throw new DataIntegrityViolationException("concurrent number conflict");
        }).when(accounts).saveAllAndFlush(anyList());
        mvc.perform(request("confirm", CSV, MAPPING).param("fingerprint", fingerprint).param("excludeInvalidRows", "true"))
                .andExpect(status().isConflict());
        assertEquals(4, accounts.count());
        assertFalse(auditLogs.findAll().stream().anyMatch(log -> "CSV_IMPORT".equals(log.getAction())));
    }

    @Test
    @Sql(statements = {
            "INSERT INTO organizations (organization_id, name, legal_name, siret, email) VALUES (2000, 'Other', 'Other', '12345678901234', 'other@example.com')",
            "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, is_active) VALUES (2000, 2000, 1, 'Other', 'Admin', 'other-import@example.com', 'unused', true)"
    })
    @Sql(executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD, statements = {
            "DELETE FROM audit_logs WHERE organization_id = 2000", "DELETE FROM chart_of_accounts WHERE organization_id = 2000",
            "DELETE FROM users WHERE user_id = 2000", "DELETE FROM organizations WHERE organization_id = 2000"
    })
    void previewAndConfirmationAreBoundToAuthenticatedOrganization() throws Exception {
        String csv = "number,label,type,active\n401000,Other suppliers,PASSIF,true\n";
        String fingerprint = preview(csv, MAPPING);
        mvc.perform(request("preview", csv, MAPPING).with(user("other-import@example.com").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.existingAccounts").value(0)).andExpect(jsonPath("$.newAccounts").value(1));
        mvc.perform(request("confirm", csv, MAPPING).with(user("other-import@example.com").roles("ADMIN")).param("fingerprint", fingerprint))
                .andExpect(status().isConflict());
        assertEquals("Fournisseurs", accounts.findById(1L).orElseThrow().getAccountLabel());
    }

    @ParameterizedTest
    @ValueSource(strings = {"OPERATEUR_COMPTABLE", "RESPONSABLE_COMPTABLE"})
    void reservesAllImportEndpointsToAdministrators(String role) throws Exception {
        for (String action : List.of("inspect", "preview", "confirm")) {
            mvc.perform(request(action, CSV, MAPPING).with(user("admin@facturation-demo.fr").roles(role)))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(request("inspect", CSV, null).with(anonymous())).andExpect(status().isUnauthorized());
    }

    private String preview(String csv, String mapping) throws Exception {
        String json = mvc.perform(request("preview", csv, mapping)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new ObjectMapper().readTree(json).get("fingerprint").asText();
    }

    private MockMultipartHttpServletRequestBuilder request(String action, String csv, String mapping) {
        var request = multipart("/api/v1/chart-of-accounts/import/" + action)
                .file(new MockMultipartFile("file", "plan.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                .param("delimiter", ",");
        request.with(user("admin@facturation-demo.fr").roles("ADMIN"));
        if (mapping != null) request.file(new MockMultipartFile("mapping", "mapping.json", "application/json", mapping.getBytes(StandardCharsets.UTF_8)));
        return request;
    }
}
