package org.facturation.backend.controller;

import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.AccountingRuleRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@Sql(statements = {
        "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 1000",
        "ALTER TABLE chart_of_accounts ALTER COLUMN account_id RESTART WITH 1000"
})
class AccountingRuleControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final OrganizationRepository organizationRepository;
    private final ChartOfAccountRepository chartOfAccountRepository;
    private final AccountingRuleRepository accountingRuleRepository;

    @Autowired
    AccountingRuleControllerIntegrationTest(
            AccountingRuleController accountingRuleController,
            ApiExceptionHandler apiExceptionHandler,
            OrganizationRepository organizationRepository,
            ChartOfAccountRepository chartOfAccountRepository,
            AccountingRuleRepository accountingRuleRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(accountingRuleController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.organizationRepository = organizationRepository;
        this.chartOfAccountRepository = chartOfAccountRepository;
        this.accountingRuleRepository = accountingRuleRepository;
    }

    @Test
    void listsRulesAndSignalsCompleteConfiguration() throws Exception {
        mockMvc.perform(get("/api/v1/accounting-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].accountingRuleId").value(1))
                .andExpect(jsonPath("$[0].expenseAccount.accountNumber").value("626000"))
                .andExpect(jsonPath("$[0].vatAccount.accountNumber").value("445660"))
                .andExpect(jsonPath("$[0].supplierAccount.accountNumber").value("401000"))
                .andExpect(jsonPath("$[0].configurationComplete").value(true));
    }

    @Test
    void updatesRuleWithActiveAccountFromCurrentOrganization() throws Exception {
        mockMvc.perform(patch("/api/v1/accounting-rules/{id}", 1L)
                        .contentType("application/json")
                        .content("""
                                {"expenseAccountId": 2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expenseAccount.accountId").value(2))
                .andExpect(jsonPath("$.configurationComplete").value(true));
    }

    @Test
    void rejectsInactiveAccount() throws Exception {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount inactiveAccount = createAccount(organization, false, "608000");

        mockMvc.perform(patch("/api/v1/accounting-rules/{id}", 1L)
                        .contentType("application/json")
                        .content("{\"expenseAccountId\": " + inactiveAccount.getAccountId() + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ACCOUNTING_RULE_VALIDATION_ERROR"));
    }

    @Test
    void signalsExistingConfigurationUsingAnInactiveAccount() throws Exception {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount inactiveAccount = createAccount(organization, false, "608100");
        var rule = accountingRuleRepository.findById(1L).orElseThrow();
        rule.setExpenseAccount(inactiveAccount);
        accountingRuleRepository.save(rule);

        mockMvc.perform(get("/api/v1/accounting-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].expenseAccount.active").value(false))
                .andExpect(jsonPath("$[0].configurationComplete").value(false));
    }

    @Test
    void rejectsAccountFromAnotherOrganization() throws Exception {
        Organization otherOrganization = createOrganization();
        ChartOfAccount externalAccount = createAccount(otherOrganization, true, "607100");

        mockMvc.perform(patch("/api/v1/accounting-rules/{id}", 1L)
                        .contentType("application/json")
                        .content("{\"expenseAccountId\": " + externalAccount.getAccountId() + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "expenseAccountId must reference an active account of the organization"
                ));
    }

    @Test
    void hidesRuleOutsideCurrentOrganization() throws Exception {
        mockMvc.perform(patch("/api/v1/accounting-rules/{id}", 99999L)
                        .contentType("application/json")
                        .content("{\"expenseAccountId\": 2}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACCOUNTING_RULE_NOT_FOUND"));
    }

    private Organization createOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("Other organization");
        organization.setLegalName("Other organization SAS");
        organization.setSiret("99999999999999");
        organization.setEmail("other-accounting-rules@example.com");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        return organizationRepository.save(organization);
    }

    private ChartOfAccount createAccount(Organization organization, boolean active, String accountNumber) {
        LocalDateTime now = LocalDateTime.now();
        ChartOfAccount account = new ChartOfAccount();
        account.setOrganization(organization);
        account.setAccountNumber(accountNumber);
        account.setAccountLabel("Test account");
        account.setAccountType("CHARGE");
        account.setActive(active);
        account.setCreatedAt(now);
        account.setUpdatedAt(now);
        return chartOfAccountRepository.save(account);
    }
}
