package org.facturation.backend.controller;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, "
        + "password_hash, is_active, created_at, updated_at) VALUES (9680, 1, 3, 'Test', 'Validator', "
        + "'kan-144-validator@example.com', 'not-used', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
class PendingValidationInvoiceControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void returnsOnlySubmittedInvoicesFromTheValidatorsOrganizationWithPaginationAndSorting() throws Exception {
        User validator = userRepository.findByEmailIgnoreCase("kan-144-validator@example.com").orElseThrow();
        createInvoice(validator, InvoiceStatusCode.A_VERIFIER, "KAN-144-LOW", "100.00");
        createInvoice(validator, InvoiceStatusCode.A_VERIFIER, "KAN-144-MIDDLE", "200.00");
        createInvoice(validator, InvoiceStatusCode.A_VERIFIER, "KAN-144-HIGH", "300.00");
        createInvoice(validator, InvoiceStatusCode.VALIDEE, "KAN-144-WRONG-STATUS", "999.00");
        createInvoice(createValidatorForAnotherOrganization(), InvoiceStatusCode.A_VERIFIER,
                "KAN-144-OTHER-ORGANIZATION", "999.00");
        invoiceRepository.flush();

        mockMvc.perform(get("/api/v1/invoices/pending-validation")
                        .param("page", "1")
                        .param("size", "1")
                        .param("sortBy", "totalTtc")
                        .param("direction", "DESC")
                        .header("Authorization", "Bearer " + tokenFor(validator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].invoiceNumber").value("KAN-144-MIDDLE"))
                .andExpect(jsonPath("$.content[0].status").value("A_VERIFIER"));
    }

    @Test
    void requiresTheInvoiceValidationPermission() throws Exception {
        User admin = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();

        mockMvc.perform(get("/api/v1/invoices/pending-validation")
                        .header("Authorization", "Bearer " + tokenFor(admin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(get("/api/v1/invoices/pending-validation"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    private Invoice createInvoice(User creator, InvoiceStatusCode status, String number, String totalTtc) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(creator.getOrganization());
        invoice.setCreatedByUser(creator);
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(status.getCode()).orElseThrow());
        invoice.setInvoiceNumber(number);
        invoice.setInvoiceDate(LocalDate.of(2026, 9, 1));
        invoice.setCurrencyCode("EUR");
        invoice.setTotalTtc(new BigDecimal(totalTtc));
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private User createValidatorForAnotherOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("KAN-144 other organization");
        organization.setLegalName("KAN-144 Other Organization SAS");
        organization.setSiret("73282932000074");
        organization.setEmail("kan-144-other-organization@example.com");
        organization.setDefaultCurrencyCode("EUR");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        organizationRepository.save(organization);

        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findByCode("RESPONSABLE_COMPTABLE").orElseThrow());
        user.setFirstName("Other");
        user.setLastName("Validator");
        user.setEmail("kan-144-other-validator@example.com");
        user.setPasswordHash("not-used");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private String tokenFor(User user) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(user);
    }
}
