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
        + "password_hash, is_active, created_at, updated_at) VALUES (9690, 1, 2, 'Assigned', 'Operator', "
        + "'kan-189-operator@example.com', 'not-used', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
class AssignedInvoiceControllerIntegrationTest {

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
    void returnsOnlyCurrentUsersAssignedInvoicesFromCurrentOrganizationWithStatusAndPagination() throws Exception {
        User currentUser = userRepository.findByEmailIgnoreCase("kan-189-operator@example.com").orElseThrow();
        User otherUser = createUser(currentUser.getOrganization(), "kan-189-other@example.com");
        createInvoice(currentUser.getOrganization(), currentUser, currentUser, InvoiceStatusCode.EXTRAITE,
                "KAN-189-EXTRACTED", "100.00");
        createInvoice(currentUser.getOrganization(), currentUser, currentUser, InvoiceStatusCode.A_VERIFIER,
                "KAN-189-TO-CHECK", "200.00");
        createInvoice(currentUser.getOrganization(), currentUser, currentUser, InvoiceStatusCode.VALIDEE,
                "KAN-189-VALIDATED", "300.00");
        createInvoice(currentUser.getOrganization(), currentUser, otherUser, InvoiceStatusCode.EXTRAITE,
                "KAN-189-OTHER-USER", "400.00");
        createInvoice(currentUser.getOrganization(), currentUser, null, InvoiceStatusCode.EXTRAITE,
                "KAN-189-UNASSIGNED", "500.00");

        User otherOrganizationUser = createUserForAnotherOrganization();
        createInvoice(otherOrganizationUser.getOrganization(), otherOrganizationUser, currentUser,
                InvoiceStatusCode.EXTRAITE, "KAN-189-OTHER-ORGANIZATION", "600.00");
        invoiceRepository.flush();

        mockMvc.perform(get("/api/v1/invoices/assigned-to-me")
                        .param("status", "extraite,A_VERIFIER")
                        .param("page", "1")
                        .param("size", "1")
                        .param("sortBy", "totalTtc")
                        .param("direction", "DESC")
                        .header("Authorization", "Bearer " + tokenFor(currentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].invoiceNumber").value("KAN-189-EXTRACTED"))
                .andExpect(jsonPath("$.content[0].status").value("EXTRAITE"));

        mockMvc.perform(get("/api/v1/invoices/assigned-to-me")
                        .header("Authorization", "Bearer " + tokenFor(currentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void rejectsUnknownStatusAndRequiresAuthentication() throws Exception {
        User currentUser = userRepository.findByEmailIgnoreCase("kan-189-operator@example.com").orElseThrow();

        mockMvc.perform(get("/api/v1/invoices/assigned-to-me")
                        .param("status", "INCONNU")
                        .header("Authorization", "Bearer " + tokenFor(currentUser)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unknown invoice status: INCONNU"));

        mockMvc.perform(get("/api/v1/invoices/assigned-to-me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    private Invoice createInvoice(
            Organization organization,
            User creator,
            User assignee,
            InvoiceStatusCode status,
            String number,
            String totalTtc
    ) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setCreatedByUser(creator);
        invoice.setAssignedUser(assignee);
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(status.getCode()).orElseThrow());
        invoice.setInvoiceNumber(number);
        invoice.setInvoiceDate(LocalDate.of(2026, 9, 1));
        invoice.setCurrencyCode("EUR");
        invoice.setTotalTtc(new BigDecimal(totalTtc));
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private User createUser(Organization organization, String email) {
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findByCode("OPERATEUR_COMPTABLE").orElseThrow());
        user.setFirstName("Other");
        user.setLastName("Operator");
        user.setEmail(email);
        user.setPasswordHash("not-used");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private User createUserForAnotherOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("KAN-189 other organization");
        organization.setLegalName("KAN-189 Other Organization SAS");
        organization.setSiret("73282932000074");
        organization.setEmail("kan-189-other-organization@example.com");
        organization.setDefaultCurrencyCode("EUR");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        organizationRepository.save(organization);
        return createUser(organization, "kan-189-other-organization-user@example.com");
    }

    private String tokenFor(User user) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(user);
    }
}
