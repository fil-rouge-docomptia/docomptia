package org.facturation.backend.controller;

import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@Sql(statements = {
        "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 1000",
        "ALTER TABLE chart_of_accounts ALTER COLUMN account_id RESTART WITH 1000"
})
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class ChartOfAccountControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final OrganizationRepository organizationRepository;
    private final ChartOfAccountRepository chartOfAccountRepository;

    @Autowired
    ChartOfAccountControllerIntegrationTest(
            ChartOfAccountController chartOfAccountController,
            ApiExceptionHandler apiExceptionHandler,
            OrganizationRepository organizationRepository,
            ChartOfAccountRepository chartOfAccountRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(chartOfAccountController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.organizationRepository = organizationRepository;
        this.chartOfAccountRepository = chartOfAccountRepository;
    }

    @Test
    void createsAnActiveAccountForCurrentOrganization() throws Exception {
        mockMvc.perform(post("/api/v1/chart-of-accounts")
                        .contentType("application/json")
                        .content("""
                                {
                                  "accountNumber": " 606300 ",
                                  "accountLabel": "Fournitures d'entretien",
                                  "accountType": "CHARGE"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accountNumber").value("606300"))
                .andExpect(jsonPath("$.accountLabel").value("Fournitures d'entretien"))
                .andExpect(jsonPath("$.accountType").value("CHARGE"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
    }

    @Test
    void rejectsDuplicateAccountNumberWithinCurrentOrganization() throws Exception {
        mockMvc.perform(post("/api/v1/chart-of-accounts")
                        .contentType("application/json")
                        .content("""
                                {
                                  "accountNumber": "401000",
                                  "accountLabel": "Duplicate",
                                  "accountType": "PASSIF"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CHART_OF_ACCOUNT_CONFLICT"));
    }

    @Test
    void listsOnlyAccountsFromCurrentOrganization() throws Exception {
        Organization otherOrganization = createOrganization("list");
        createAccount(otherOrganization, "999999", "Hidden account");

        mockMvc.perform(get("/api/v1/chart-of-accounts").param("page", "0").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.content[*].accountNumber", not(hasItem("999999"))));
    }

    @Test
    void returnsAccountDetailsFromCurrentOrganization() throws Exception {
        mockMvc.perform(get("/api/v1/chart-of-accounts/{id}", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(1))
                .andExpect(jsonPath("$.accountNumber").value("401000"))
                .andExpect(jsonPath("$.accountLabel").value("Fournisseurs"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void hidesAccountFromAnotherOrganization() throws Exception {
        ChartOfAccount hiddenAccount = createAccount(createOrganization("details"), "999998", "Hidden account");

        mockMvc.perform(get("/api/v1/chart-of-accounts/{id}", hiddenAccount.getAccountId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CHART_OF_ACCOUNT_NOT_FOUND"));
    }

    @Test
    void updatesAccountFromCurrentOrganization() throws Exception {
        mockMvc.perform(patch("/api/v1/chart-of-accounts/{id}", 2L)
                        .contentType("application/json")
                        .content("""
                                {
                                  "accountNumber": "607100",
                                  "accountLabel": "Achats modifies"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountNumber").value("607100"))
                .andExpect(jsonPath("$.accountLabel").value("Achats modifies"))
                .andExpect(jsonPath("$.accountType").value("CHARGE"));
    }

    @Test
    void rejectsDuplicateAccountNumberOnUpdate() throws Exception {
        mockMvc.perform(patch("/api/v1/chart-of-accounts/{id}", 2L)
                        .contentType("application/json")
                        .content("{\"accountNumber\": \"401000\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CHART_OF_ACCOUNT_CONFLICT"));
    }

    @Test
    void refusesUpdateForAccountFromAnotherOrganization() throws Exception {
        ChartOfAccount hiddenAccount = createAccount(createOrganization("update"), "999997", "Hidden account");

        mockMvc.perform(patch("/api/v1/chart-of-accounts/{id}", hiddenAccount.getAccountId())
                .contentType("application/json")
                        .content("{\"accountLabel\": \"Unauthorized update\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CHART_OF_ACCOUNT_NOT_FOUND"));
    }

    @Test
    void deactivatesAccountAlreadyUsedByAccountingRulesWithoutDeletingIt() throws Exception {
        mockMvc.perform(post("/api/v1/chart-of-accounts/{id}/deactivate", 4L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(4))
                .andExpect(jsonPath("$.active").value(false));

        ChartOfAccount account = chartOfAccountRepository.findById(4L).orElseThrow();
        assertFalse(account.isActive());
    }

    @Test
    void refusesDeactivationForAccountFromAnotherOrganization() throws Exception {
        ChartOfAccount hiddenAccount = createAccount(createOrganization("deactivate"), "999996", "Hidden account");

        mockMvc.perform(post("/api/v1/chart-of-accounts/{id}/deactivate", hiddenAccount.getAccountId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CHART_OF_ACCOUNT_NOT_FOUND"));
    }

    @Test
    void databaseEnforcesAccountNumberUniquenessWithinOrganization() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount duplicate = account(organization, "401000", "Duplicate");

        assertThrows(DataIntegrityViolationException.class, () -> chartOfAccountRepository.saveAndFlush(duplicate));
    }

    @Test
    void allowsSameAccountNumberInAnotherOrganization() {
        ChartOfAccount account = createAccount(createOrganization("same-number"), "401000", "Other suppliers");

        assertNotNull(account.getAccountId());
    }

    private Organization createOrganization(String suffix) {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("Organization " + suffix);
        organization.setLegalName("Organization " + suffix + " SAS");
        organization.setSiret(uniqueDigits());
        organization.setEmail(suffix + "@example.com");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        return organizationRepository.save(organization);
    }

    private ChartOfAccount createAccount(Organization organization, String number, String label) {
        return chartOfAccountRepository.save(account(organization, number, label));
    }

    private ChartOfAccount account(Organization organization, String number, String label) {
        LocalDateTime now = LocalDateTime.now();
        ChartOfAccount account = new ChartOfAccount();
        account.setOrganization(organization);
        account.setAccountNumber(number);
        account.setAccountLabel(label);
        account.setAccountType("CHARGE");
        account.setActive(true);
        account.setCreatedAt(now);
        account.setUpdatedAt(now);
        return account;
    }

    private String uniqueDigits() {
        String value = Long.toString(System.nanoTime());
        return value.substring(Math.max(0, value.length() - 14));
    }
}
