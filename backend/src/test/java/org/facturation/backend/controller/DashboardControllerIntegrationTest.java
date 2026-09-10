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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
        deposited.setInvoiceDate(LocalDate.of(2026, 8, 1));
        Invoice extracted = createInvoice(currentUser, InvoiceStatusCode.EXTRAITE, "DASH-EXTRACTED", "20", "4", "24");
        extracted.setUpdatedAt(LocalDateTime.of(2026, 8, 20, 12, 0));
        Invoice awaitingValidation = createInvoice(
                currentUser, InvoiceStatusCode.A_VERIFIER, "DASH-TO-VALIDATE", "30", "6", "36"
        );
        awaitingValidation.setUpdatedAt(LocalDateTime.of(2026, 8, 20, 11, 0));
        Invoice exportable = createInvoice(currentUser, InvoiceStatusCode.EXPORTABLE, "DASH-EXPORTABLE", "40", "8", "48");
        exportable.setInvoiceDate(LocalDate.of(2026, 8, 31));
        Invoice ocrError = createInvoice(
                currentUser, InvoiceStatusCode.ERREUR_OCR, "DASH-OCR-ERROR", null, null, null
        );
        ocrError.setUpdatedAt(LocalDateTime.of(2026, 8, 20, 10, 0));
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
                .andExpect(jsonPath("$.statusDistribution.length()").value(InvoiceStatusCode.values().length))
                .andExpect(jsonPath("$.statusDistribution[0].status").value("ARCHIVEE"))
                .andExpect(jsonPath("$.statusDistribution[0].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[1].status").value("A_VERIFIER"))
                .andExpect(jsonPath("$.statusDistribution[1].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[2].status").value("BROUILLON"))
                .andExpect(jsonPath("$.statusDistribution[2].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[3].status").value("COMPTABILISEE"))
                .andExpect(jsonPath("$.statusDistribution[3].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[4].status").value("DEPOSEE"))
                .andExpect(jsonPath("$.statusDistribution[4].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[5].status").value("ERREUR_OCR"))
                .andExpect(jsonPath("$.statusDistribution[5].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[6].status").value("ERREUR_TRAITEMENT"))
                .andExpect(jsonPath("$.statusDistribution[6].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[7].status").value("EXPORTABLE"))
                .andExpect(jsonPath("$.statusDistribution[7].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[8].status").value("EXPORTEE"))
                .andExpect(jsonPath("$.statusDistribution[8].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[9].status").value("EXTRAITE"))
                .andExpect(jsonPath("$.statusDistribution[9].count").value(1))
                .andExpect(jsonPath("$.statusDistribution[10].status").value("OCR_EN_COURS"))
                .andExpect(jsonPath("$.statusDistribution[10].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[11].status").value("PAYEE"))
                .andExpect(jsonPath("$.statusDistribution[11].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[12].status").value("REJETEE"))
                .andExpect(jsonPath("$.statusDistribution[12].count").value(0))
                .andExpect(jsonPath("$.statusDistribution[13].status").value("VALIDEE"))
                .andExpect(jsonPath("$.statusDistribution[13].count").value(0))
                .andExpect(jsonPath("$.actionRequiredInvoices.length()").value(3))
                .andExpect(jsonPath("$.actionRequiredInvoices[0].invoiceNumber").value("DASH-EXTRACTED"))
                .andExpect(jsonPath("$.actionRequiredInvoices[0].requiredAction").value("VERIFIER"))
                .andExpect(jsonPath("$.actionRequiredInvoices[1].invoiceNumber").value("DASH-TO-VALIDATE"))
                .andExpect(jsonPath("$.actionRequiredInvoices[1].requiredAction").value("VALIDER"))
                .andExpect(jsonPath("$.actionRequiredInvoices[2].invoiceNumber").value("DASH-OCR-ERROR"))
                .andExpect(jsonPath("$.actionRequiredInvoices[2].requiredAction").value("DEBLOQUER"));
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
                .andExpect(jsonPath("$.statusDistribution.length()").value(InvoiceStatusCode.values().length))
                .andExpect(jsonPath("$.statusDistribution[*].count").value(org.hamcrest.Matchers.everyItem(
                        org.hamcrest.Matchers.is(0)
                )))
                .andExpect(jsonPath("$.actionRequiredInvoices").isEmpty());
    }

    @Test
    void countsOnlyCurrentOrganizationsOcrErrorsForTheRequestedPeriod() throws Exception {
        User currentUser = userRepository.findById(1L).orElseThrow();
        Invoice startDateOcrError = createInvoice(
                currentUser, InvoiceStatusCode.ERREUR_OCR, "DASH-OCR-START", null, null, null
        );
        startDateOcrError.setInvoiceDate(LocalDate.of(2026, 8, 1));
        Invoice endDateOcrError = createInvoice(
                currentUser, InvoiceStatusCode.ERREUR_OCR, "DASH-OCR-END", null, null, null
        );
        endDateOcrError.setInvoiceDate(LocalDate.of(2026, 8, 31));
        createInvoice(currentUser, InvoiceStatusCode.EXTRAITE, "DASH-NOT-OCR-ERROR", "10", "2", "12");
        Invoice outsidePeriodOcrError = createInvoice(
                currentUser, InvoiceStatusCode.ERREUR_OCR, "DASH-OCR-OUTSIDE", null, null, null
        );
        outsidePeriodOcrError.setInvoiceDate(LocalDate.of(2026, 7, 31));

        User otherOrganizationUser = createUserForNewOrganization(
                "Dashboard OCR other organization",
                "dashboard-ocr-other@example.com",
                "73282932000066",
                "other-dashboard-ocr@example.com",
                "unused"
        );
        createInvoice(
                otherOrganizationUser, InvoiceStatusCode.ERREUR_OCR, "DASH-OCR-OTHER-ORG", null, null, null
        );
        invoiceRepository.flush();

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alerts.ocrErrors").value(2));
    }

    @Test
    void countsOnlyCurrentOrganizationsPendingDuplicateInvoicesForTheRequestedPeriod() throws Exception {
        User currentUser = userRepository.findById(1L).orElseThrow();
        Invoice matchingInvoice = createInvoice(
                currentUser, InvoiceStatusCode.EXTRAITE, "DASH-DUPLICATE-MATCH", "10", "2", "12"
        );
        Invoice startDateDuplicate = createInvoice(
                currentUser, InvoiceStatusCode.EXTRAITE, "DASH-DUPLICATE-START", "10", "2", "12"
        );
        startDateDuplicate.setInvoiceDate(LocalDate.of(2026, 8, 1));
        createPendingDuplicateAlert(startDateDuplicate, matchingInvoice);
        createPendingDuplicateAlert(startDateDuplicate, createInvoice(
                currentUser, InvoiceStatusCode.EXTRAITE, "DASH-DUPLICATE-SECOND-MATCH", "10", "2", "12"
        ));

        Invoice endDateDuplicate = createInvoice(
                currentUser, InvoiceStatusCode.EXTRAITE, "DASH-DUPLICATE-END", "20", "4", "24"
        );
        endDateDuplicate.setInvoiceDate(LocalDate.of(2026, 8, 31));
        createPendingDuplicateAlert(endDateDuplicate, matchingInvoice);

        Invoice resolvedDuplicate = createInvoice(
                currentUser, InvoiceStatusCode.EXTRAITE, "DASH-DUPLICATE-RESOLVED", "30", "6", "36"
        );
        createDuplicateAlert(resolvedDuplicate, matchingInvoice, DuplicateAlertDecision.IGNORE);

        Invoice outsidePeriodDuplicate = createInvoice(
                currentUser, InvoiceStatusCode.EXTRAITE, "DASH-DUPLICATE-OUTSIDE", "40", "8", "48"
        );
        outsidePeriodDuplicate.setInvoiceDate(LocalDate.of(2026, 7, 31));
        createPendingDuplicateAlert(outsidePeriodDuplicate, matchingInvoice);

        createInvoiceForAnotherOrganization();
        invoiceRepository.flush();

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alerts.pendingDuplicates").value(2));
    }

    @Test
    void countsOnlyCurrentOrganizationsCurrentlyUnbalancedEntriesForTheRequestedPeriod() throws Exception {
        User currentUser = userRepository.findById(1L).orElseThrow();
        Invoice unbalancedInvoice = createInvoice(
                currentUser, InvoiceStatusCode.VALIDEE, "DASH-UNBALANCED", "10", "2", "12"
        );
        unbalancedInvoice.setInvoiceDate(LocalDate.of(2026, 8, 1));
        AccountingEntryLine lineToCorrect = createUnbalancedEntry(unbalancedInvoice, currentUser);

        Invoice outsidePeriodInvoice = createInvoice(
                currentUser, InvoiceStatusCode.VALIDEE, "DASH-UNBALANCED-OUTSIDE", "10", "2", "12"
        );
        outsidePeriodInvoice.setInvoiceDate(LocalDate.of(2026, 7, 31));
        createUnbalancedEntry(outsidePeriodInvoice, currentUser);

        createInvoiceForAnotherOrganization();
        invoiceRepository.flush();

        String token = loginAndGetToken();
        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alerts.unbalancedAccountingEntries").value(1));

        mockMvc.perform(patch("/api/v1/accounting-entries/{entryId}/lines/{lineId}",
                        lineToCorrect.getAccountingEntry().getAccountingEntryId(),
                        lineToCorrect.getAccountingEntryLineId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"creditAmount": 10.00}
                                """)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balanced").value(true));

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alerts.unbalancedAccountingEntries").value(0));
    }

    @Test
    void limitsActionRequiredInvoicesAndReturnsTheCorrectionAction() throws Exception {
        User currentUser = userRepository.findById(1L).orElseThrow();
        Invoice rejected = createInvoice(
                currentUser, InvoiceStatusCode.REJETEE, "DASH-REJECTED", "10", "2", "12"
        );
        rejected.setUpdatedAt(LocalDateTime.of(2026, 8, 22, 12, 0));
        Invoice extracted = createInvoice(
                currentUser, InvoiceStatusCode.EXTRAITE, "DASH-EXTRACTED-LIMIT", "20", "4", "24"
        );
        extracted.setUpdatedAt(LocalDateTime.of(2026, 8, 22, 11, 0));
        Invoice excludedByLimit = createInvoice(
                currentUser, InvoiceStatusCode.A_VERIFIER, "DASH-EXCLUDED-BY-LIMIT", "30", "6", "36"
        );
        excludedByLimit.setUpdatedAt(LocalDateTime.of(2026, 8, 22, 10, 0));
        invoiceRepository.flush();

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .param("startDate", "2026-08-01")
                        .param("endDate", "2026-08-31")
                        .param("actionLimit", "2")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionRequiredInvoices.length()").value(2))
                .andExpect(jsonPath("$.actionRequiredInvoices[0].invoiceNumber").value("DASH-REJECTED"))
                .andExpect(jsonPath("$.actionRequiredInvoices[0].requiredAction").value("CORRIGER"))
                .andExpect(jsonPath("$.actionRequiredInvoices[1].invoiceNumber").value("DASH-EXTRACTED-LIMIT"));
    }

    @Test
    void rejectsAnInvalidActionInvoiceLimit() throws Exception {
        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .param("actionLimit", "101")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("actionLimit must be between 1 and 100"));
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
        createDuplicateAlert(invoice, matchingInvoice, DuplicateAlertDecision.PENDING);
    }

    private void createDuplicateAlert(
            Invoice invoice,
            Invoice matchingInvoice,
            DuplicateAlertDecision decision
    ) {
        InvoiceDuplicateAlert alert = new InvoiceDuplicateAlert();
        alert.setInvoice(invoice);
        alert.setMatchingInvoice(matchingInvoice);
        alert.setSupplier(invoice.getSupplier());
        alert.setAlertType(DuplicateAlertType.PROBABLE);
        alert.setInvoiceDate(invoice.getInvoiceDate());
        alert.setTotalTtc(invoice.getTotalTtc());
        alert.setDecision(decision);
        alert.setCreatedAt(LocalDateTime.now());
        duplicateAlertRepository.save(alert);
    }

    private AccountingEntryLine createUnbalancedEntry(Invoice invoice, User user) {
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

        ChartOfAccount account = createDashboardAccount(
                invoice.getOrganization(), entry.getAccountingEntryId()
        );
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(entry);
        line.setAccount(account);
        line.setLineNumber(1);
        line.setLineLabel("Unbalanced line");
        line.setDebitAmount(new BigDecimal("10.00"));
        line.setCreditAmount(BigDecimal.ZERO.setScale(2));
        line.setCreatedAt(LocalDateTime.now());
        return accountingEntryLineRepository.save(line);
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

    private ChartOfAccount createDashboardAccount(Organization organization, Long accountingEntryId) {
        ChartOfAccount account = new ChartOfAccount();
        account.setOrganization(organization);
        account.setAccountNumber("DASH-" + organization.getOrganizationId() + "-" + accountingEntryId);
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
