package org.facturation.backend.controller;

import org.facturation.backend.model.Client;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.ClientRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.OrganizationSubscriptionRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CustomerInvoiceControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationSubscriptionRepository organizationSubscriptionRepository;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void createsCustomerDraftForCurrentOrganizationWithoutDefinitiveNumber() throws Exception {
        Client client = createClient(userOrganization(), "Client Alpha");

        String response = mockMvc.perform(post("/api/v1/customer-invoices")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType("application/json")
                        .content("""
                                {
                                  "clientId": %d,
                                  "currencyCode": "eur",
                                  "invoiceDate": "2026-09-07",
                                  "dueDate": "2026-10-07",
                                  "commandReference": " CMD-214 ",
                                  "description": " Prestation de septembre "
                                }
                                """.formatted(client.getClientId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clientId").value(client.getClientId()))
                .andExpect(jsonPath("$.clientName").value("Client Alpha"))
                .andExpect(jsonPath("$.status").value("BROUILLON"))
                .andExpect(jsonPath("$.invoiceNumber").doesNotExist())
                .andExpect(jsonPath("$.currencyCode").value("EUR"))
                .andExpect(jsonPath("$.commandReference").value("CMD-214"))
                .andReturn().getResponse().getContentAsString();

        Long invoiceId = Long.valueOf(response.replaceAll(".*\"invoiceId\":(\\d+).*", "$1"));
        Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
        assertEquals(userOrganization().getOrganizationId(), invoice.getOrganization().getOrganizationId());
        assertEquals(client.getClientId(), invoice.getClient().getClientId());
        assertEquals(InvoiceStatusCode.BROUILLON.getCode(), invoice.getInvoiceStatus().getCode());
        assertNull(invoice.getInvoiceNumber());
        assertNull(invoice.getSupplier());
    }

    @Test
    void rejectsCustomerDraftWhenMonthlyInvoiceLimitIsReachedWithoutCreatingInvoice() throws Exception {
        Client client = createClient(userOrganization(), "Client quota");
        long invoiceCount = invoiceRepository.count();
        int monthlyUsage = Math.toIntExact(invoiceRepository
                .countByOrganizationOrganizationIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        userOrganization().getOrganizationId(),
                        java.time.YearMonth.now().atDay(1).atStartOfDay(),
                        java.time.YearMonth.now().plusMonths(1).atDay(1).atStartOfDay()
                ));
        var subscription = organizationSubscriptionRepository
                .findByOrganizationOrganizationId(userOrganization().getOrganizationId())
                .orElseThrow();
        subscription.getPlan().findLimitsAt(java.time.LocalDate.now()).orElseThrow()
                .setMonthlyInvoiceLimit(monthlyUsage);

        mockMvc.perform(post("/api/v1/customer-invoices")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType("application/json")
                        .content("""
                                {"clientId": %d, "currencyCode": "EUR"}
                                """.formatted(client.getClientId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SUBSCRIPTION_LIMIT_REACHED"))
                .andExpect(jsonPath("$.limit").value("MONTHLY_INVOICE_LIMIT"))
                .andExpect(jsonPath("$.quota").value(monthlyUsage))
                .andExpect(jsonPath("$.usage").value(monthlyUsage));

        assertEquals(invoiceCount, invoiceRepository.count());
    }

    @Test
    void updatesCustomerDraftAndKeepsItUnnumbered() throws Exception {
        Client firstClient = createClient(userOrganization(), "Client Alpha");
        Client secondClient = createClient(userOrganization(), "Client Beta");
        Invoice invoice = createDraft(firstClient);

        mockMvc.perform(patch("/api/v1/customer-invoices/{id}", invoice.getInvoiceId())
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType("application/json")
                        .content("""
                                {
                                  "clientId": %d,
                                  "currencyCode": "USD",
                                  "dueDate": "2026-11-15",
                                  "description": "Description modifiee"
                                }
                                """.formatted(secondClient.getClientId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").value(secondClient.getClientId()))
                .andExpect(jsonPath("$.status").value("BROUILLON"))
                .andExpect(jsonPath("$.invoiceNumber").doesNotExist())
                .andExpect(jsonPath("$.currencyCode").value("USD"))
                .andExpect(jsonPath("$.dueDate").value("2026-11-15"));

        Invoice updatedInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertEquals(secondClient.getClientId(), updatedInvoice.getClient().getClientId());
        assertNull(updatedInvoice.getInvoiceNumber());
    }

    @Test
    void refusesClientFromAnotherOrganization() throws Exception {
        Organization otherOrganization = createOrganization("21499999999999", "other-kan214@example.com");
        Client otherClient = createClient(otherOrganization, "Other organization client");

        mockMvc.perform(post("/api/v1/customer-invoices")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType("application/json")
                        .content("""
                                {"clientId": %d, "currencyCode": "EUR"}
                                """.formatted(otherClient.getClientId())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CLIENT_NOT_FOUND"));
    }

    @Test
    void refusesToModifyAnInvoiceThatIsNoLongerADraft() throws Exception {
        Client client = createClient(userOrganization(), "Client Alpha");
        Invoice invoice = createDraft(client);
        invoice.setInvoiceStatus(invoiceStatus(InvoiceStatusCode.VALIDEE));
        invoiceRepository.save(invoice);

        mockMvc.perform(patch("/api/v1/customer-invoices/{id}", invoice.getInvoiceId())
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType("application/json")
                        .content("""
                                {"description": "Modification interdite"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CUSTOMER_INVOICE_DRAFT_VALIDATION_ERROR"));
    }

    private Invoice createDraft(Client client) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(userOrganization());
        invoice.setClient(client);
        invoice.setInvoiceStatus(invoiceStatus(InvoiceStatusCode.BROUILLON));
        invoice.setCreatedByUser(userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow());
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private org.facturation.backend.model.InvoiceStatus invoiceStatus(InvoiceStatusCode code) {
        return invoiceStatusRepository.findByCode(code.getCode()).orElseThrow();
    }

    private Client createClient(Organization organization, String name) {
        Client client = new Client();
        client.setOrganization(organization);
        client.setName(name);
        client.setCreatedAt(LocalDateTime.now());
        client.setUpdatedAt(LocalDateTime.now());
        return clientRepository.save(client);
    }

    private Organization createOrganization(String siret, String email) {
        Organization organization = new Organization();
        organization.setName("Other organization");
        organization.setLegalName("Other organization SAS");
        organization.setSiret(siret);
        organization.setEmail(email);
        organization.setDefaultCurrencyCode("EUR");
        organization.setCreatedAt(LocalDateTime.now());
        organization.setUpdatedAt(LocalDateTime.now());
        return organizationRepository.save(organization);
    }

    private Organization userOrganization() {
        return userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow().getOrganization();
    }

    private String adminToken() {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow()
        );
    }
}
