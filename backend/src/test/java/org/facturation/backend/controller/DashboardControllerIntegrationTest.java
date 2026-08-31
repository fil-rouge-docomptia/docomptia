package org.facturation.backend.controller;

import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.DuplicateAlertDecision;
import org.facturation.backend.model.DuplicateAlertType;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.InvoiceDuplicateAlertRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "ALTER TABLE suppliers ALTER COLUMN supplier_id RESTART WITH 1000",
        "ALTER TABLE chart_of_accounts ALTER COLUMN account_id RESTART WITH 1000"
})
class DashboardControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    private InvoiceDuplicateAlertRepository duplicateAlertRepository;

    @Autowired
    private AccountingEntryRepository accountingEntryRepository;

    @Autowired
    private AccountingEntryLineRepository accountingEntryLineRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private ChartOfAccountRepository chartOfAccountRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void returnsTheCurrentOrganizationsSummaryForTheRequestedPeriod() throws Exception {
        User currentUser = userRepository.findById(1L).orElseThrow();
        Invoice deposited = createInvoice(currentUser, InvoiceStatusCode.DEPOSEE, "DASH-DEPOSITED", "10", "2", "12");
        Invoice extracted = createInvoice(currentUser, InvoiceStatusCode.EXTRAITE, "DASH-EXTRACTED", "20", "4", "24");
        createInvoice(currentUser, InvoiceStatusCode.A_VERIFIER, "DASH-TO-VALIDATE", "30", "6", "36");
        Invoice exportable = createInvoice(currentUser, InvoiceStatusCode.EXPORTABLE, "DASH-EXPORTABLE", "40", "8", "48");
        createInvoice(currentUser, InvoiceStatusCode.ERREUR_OCR, "DASH-OCR-ERROR", null, null, null);
        Invoice outsidePeriod = createInvoice(
                currentUser, InvoiceStatusCode.VALIDEE, "DASH-OUTSIDE-PERIOD", "500", "100", "600"
        );
        outsidePeriod.setInvoiceDate(LocalDate.of(2026, 7, 31));

        createPendingDuplicateAlert(extracted, deposited);
        createUnbalancedEntry(exportable, currentUser);
        createInvoiceForAnotherOrganization();
        invoiceRepository.flush();

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.period.startDate").value("2026-08-01"))
                .andExpect(jsonPath("$.period.endDate").value("2026-08-31"))
                .andExpect(jsonPath("$.totals.invoiceCount").value(5))
                .andExpect(jsonPath("$.totals.totalHt").value(100.00))
                .andExpect(jsonPath("$.totals.totalTva").value(20.00))
                .andExpect(jsonPath("$.totals.totalTtc").value(120.00))
                .andExpect(jsonPath("$.workQueues.toProcess").value(1))
                .andExpect(jsonPath("$.workQueues.toVerify").value(1))
                .andExpect(jsonPath("$.workQueues.awaitingValidation").value(1))
                .andExpect(jsonPath("$.workQueues.exportable").value(1))
                .andExpect(jsonPath("$.alerts.ocrErrors").value(1))
                .andExpect(jsonPath("$.alerts.pendingDuplicates").value(1))
                .andExpect(jsonPath("$.alerts.unbalancedAccountingEntries").value(1))
                .andExpect(jsonPath("$.statusDistribution.length()").value(5));
    }

    @Test
    void rejectsAnInvalidPeriodWithoutChangingInvoices() throws Exception {
        long invoiceCountBeforeRequest = invoiceRepository.count();

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .param("startDate", "2026-08-31")
                        .param("endDate", "2026-08-01")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("startDate must be before or equal to endDate"));

        org.assertj.core.api.Assertions.assertThat(invoiceRepository.count()).isEqualTo(invoiceCountBeforeRequest);
    }

    @Test
    void returnsZeroIndicatorsForAnOrganizationWithoutData() throws Exception {
        User user = createUserForNewOrganization(
                "Dashboard empty organization",
                "dashboard-empty@example.com",
                "73282932000082",
                "empty-dashboard@example.com",
                passwordEncoder.encode("empty-dashboard-password")
        );

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .header("Authorization", "Bearer " + loginAndGetToken(
                                user.getEmail(), "empty-dashboard-password"
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.invoiceCount").value(0))
                .andExpect(jsonPath("$.totals.totalHt").value(0))
                .andExpect(jsonPath("$.totals.totalTva").value(0))
                .andExpect(jsonPath("$.totals.totalTtc").value(0))
                .andExpect(jsonPath("$.workQueues.toProcess").value(0))
                .andExpect(jsonPath("$.workQueues.toVerify").value(0))
                .andExpect(jsonPath("$.workQueues.awaitingValidation").value(0))
                .andExpect(jsonPath("$.workQueues.exportable").value(0))
                .andExpect(jsonPath("$.alerts.ocrErrors").value(0))
                .andExpect(jsonPath("$.alerts.pendingDuplicates").value(0))
                .andExpect(jsonPath("$.alerts.unbalancedAccountingEntries").value(0))
                .andExpect(jsonPath("$.statusDistribution.length()").value(0));
    }

    private Invoice createInvoice(
            User user,
            InvoiceStatusCode statusCode,
            String invoiceNumber,
            String totalHt,
            String totalTva,
            String totalTtc
    ) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(user.getOrganization());
        invoice.setCreatedByUser(user);
        invoice.setSupplier(getOrCreateSupplier(user.getOrganization()));
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(statusCode.getCode()).orElseThrow());
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setInvoiceDate(LocalDate.of(2026, 8, 15));
        invoice.setCurrencyCode("EUR");
        invoice.setTotalHt(amount(totalHt));
        invoice.setTotalTva(amount(totalTva));
        invoice.setTotalTtc(amount(totalTtc));
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private void createPendingDuplicateAlert(Invoice invoice, Invoice matchingInvoice) {
        InvoiceDuplicateAlert alert = new InvoiceDuplicateAlert();
        alert.setInvoice(invoice);
        alert.setMatchingInvoice(matchingInvoice);
        alert.setSupplier(invoice.getSupplier());
        alert.setAlertType(DuplicateAlertType.PROBABLE);
        alert.setInvoiceDate(invoice.getInvoiceDate());
        alert.setTotalTtc(invoice.getTotalTtc());
        alert.setDecision(DuplicateAlertDecision.PENDING);
        alert.setCreatedAt(LocalDateTime.now());
        duplicateAlertRepository.save(alert);
    }

    private void createUnbalancedEntry(Invoice invoice, User user) {
        AccountingEntry entry = new AccountingEntry();
        entry.setInvoice(invoice);
        entry.setCreatedByUser(user);
        entry.setEntryNumber("DASH-ENTRY");
        entry.setEntryDate(invoice.getInvoiceDate());
        entry.setLabel("Dashboard test entry");
        entry.setStatus("GENERATED");
        entry.setCreatedAt(LocalDateTime.now());
        entry.setUpdatedAt(LocalDateTime.now());
        accountingEntryRepository.save(entry);

        ChartOfAccount account = createDashboardAccount(invoice.getOrganization());
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(entry);
        line.setAccount(account);
        line.setLineNumber(1);
        line.setLineLabel("Unbalanced line");
        line.setDebitAmount(new BigDecimal("10.00"));
        line.setCreditAmount(BigDecimal.ZERO.setScale(2));
        line.setCreatedAt(LocalDateTime.now());
        accountingEntryLineRepository.save(line);
    }

    private Supplier getOrCreateSupplier(Organization organization) {
        return supplierRepository.findByOrganizationOrganizationIdAndNameIgnoreCase(
                        organization.getOrganizationId(),
                        "Dashboard supplier"
                )
                .orElseGet(() -> {
                    Supplier supplier = new Supplier();
                    supplier.setOrganization(organization);
                    supplier.setName("Dashboard supplier");
                    supplier.setLegalName("Dashboard supplier");
                    supplier.setCreatedAt(LocalDateTime.now());
                    supplier.setUpdatedAt(LocalDateTime.now());
                    return supplierRepository.save(supplier);
                });
    }

    private ChartOfAccount createDashboardAccount(Organization organization) {
        ChartOfAccount account = new ChartOfAccount();
        account.setOrganization(organization);
        account.setAccountNumber("DASH-" + organization.getOrganizationId());
        account.setAccountLabel("Dashboard test account");
        account.setAccountType("TEST");
        account.setActive(true);
        account.setCreatedAt(LocalDateTime.now());
        account.setUpdatedAt(LocalDateTime.now());
        return chartOfAccountRepository.save(account);
    }

    private void createInvoiceForAnotherOrganization() {
        User user = createUserForNewOrganization(
                "Dashboard other organization",
                "dashboard-other@example.com",
                "73282932000074",
                "other-dashboard@example.com",
                "unused"
        );
        Invoice invoice = createInvoice(
                user, InvoiceStatusCode.DEPOSEE, "DASH-OTHER-ORG", "999", "199.80", "1198.80"
        );
        Invoice matchingInvoice = createInvoice(
                user, InvoiceStatusCode.EXTRAITE, "DASH-OTHER-ORG-MATCH", "999", "199.80", "1198.80"
        );
        createPendingDuplicateAlert(invoice, matchingInvoice);
        createUnbalancedEntry(invoice, user);
    }

    private User createUserForNewOrganization(
            String organizationName,
            String organizationEmail,
            String organizationSiret,
            String userEmail,
            String passwordHash
    ) {
        Organization organization = new Organization();
        organization.setName(organizationName);
        organization.setLegalName(organizationName + " SAS");
        organization.setEmail(organizationEmail);
        organization.setSiret(organizationSiret);
        organization.setDefaultCurrencyCode("EUR");
        organization.setCreatedAt(LocalDateTime.now());
        organization.setUpdatedAt(LocalDateTime.now());
        organizationRepository.save(organization);

        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findById(1L).orElseThrow());
        user.setFirstName("Other");
        user.setLastName("Dashboard");
        user.setEmail(userEmail);
        user.setPasswordHash(passwordHash);
        user.setActive(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    private BigDecimal amount(String value) {
        return value == null ? null : new BigDecimal(value);
    }

    private String loginAndGetToken() throws Exception {
        return loginAndGetToken("admin@facturation-demo.fr", "admin123");
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(
                                java.util.Map.of("email", email, "password", password)
                        )))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("token").asText();
    }
}
