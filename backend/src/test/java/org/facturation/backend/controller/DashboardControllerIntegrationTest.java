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
        alert.setSupplier(supplierRepository.findById(1L).orElseThrow());
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

        ChartOfAccount account = chartOfAccountRepository.findById(1L).orElseThrow();
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

    private void createInvoiceForAnotherOrganization() {
        Organization organization = new Organization();
        organization.setName("Dashboard other organization");
        organization.setLegalName("Dashboard Other Organization SAS");
        organization.setSiret("73282932000074");
        organization.setEmail("dashboard-other@example.com");
        organization.setDefaultCurrencyCode("EUR");
        organization.setCreatedAt(LocalDateTime.now());
        organization.setUpdatedAt(LocalDateTime.now());
        organizationRepository.save(organization);

        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findById(1L).orElseThrow());
        user.setFirstName("Other");
        user.setLastName("Dashboard");
        user.setEmail("other-dashboard@example.com");
        user.setPasswordHash("unused");
        user.setActive(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        createInvoice(user, InvoiceStatusCode.DEPOSEE, "DASH-OTHER-ORG", "999", "199.80", "1198.80");
    }

    private BigDecimal amount(String value) {
        return value == null ? null : new BigDecimal(value);
    }

    private String loginAndGetToken() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@facturation-demo.fr","password":"admin123"}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("token").asText();
    }
}
