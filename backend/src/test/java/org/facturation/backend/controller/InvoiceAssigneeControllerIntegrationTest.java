package org.facturation.backend.controller;

import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class InvoiceAssigneeControllerIntegrationTest {

    private static final String ASSIGNEE_CHANGED = "ASSIGNEE_CHANGED";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void assignsInvoiceToActiveUserInCurrentOrganizationAndAuditsAuthor() throws Exception {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User assignee = createUser(organization, true);
        Invoice invoice = createInvoice(organization);

        mockMvc.perform(patch("/api/v1/invoices/{id}/assignee", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + assignee.getUserId() + "}")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignee.id").value(assignee.getUserId()))
                .andExpect(jsonPath("$.assignee.firstName").value(assignee.getFirstName()))
                .andExpect(jsonPath("$.assignee.lastName").value(assignee.getLastName()))
                .andExpect(jsonPath("$.assignee.email").value(assignee.getEmail()))
                .andExpect(jsonPath("$.history.length()").value(1))
                .andExpect(jsonPath("$.history[0].type").value("ASSIGNMENT"))
                .andExpect(jsonPath("$.history[0].action").value(ASSIGNEE_CHANGED))
                .andExpect(jsonPath("$.history[0].fieldName").value("assigneeUserId"))
                .andExpect(jsonPath("$.history[0].newValue").value(assignee.getUserId().toString()))
                .andExpect(jsonPath("$.history[0].date").isNotEmpty())
                .andExpect(jsonPath("$.history[0].authorId").value(1))
                .andExpect(jsonPath("$.history[0].author").value("Admin Demo"));

        Invoice persistedInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertThat(persistedInvoice.getAssignedUser().getUserId()).isEqualTo(assignee.getUserId());

        AuditLog auditLog = findAssignmentLogs(invoice).getFirst();
        assertThat(auditLog.getUser().getUserId()).isEqualTo(1L);
        assertThat(auditLog.getOldValue()).isEqualTo("assigneeUserId=null");
        assertThat(auditLog.getNewValue()).isEqualTo("assigneeUserId=" + assignee.getUserId());
        assertThat(auditLog.getCreatedAt()).isNotNull();
    }

    @Test
    void rejectsInactiveOrOtherOrganizationUserWithoutChangingAssignment() throws Exception {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        Invoice invoice = createInvoice(organization);
        User inactiveUser = createUser(organization, false);

        mockMvc.perform(patch("/api/v1/invoices/{id}/assignee", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + inactiveUser.getUserId() + "}")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USER_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Assigned user must be active"));

        User otherOrganizationUser = createUser(createOrganization(), true);
        mockMvc.perform(patch("/api/v1/invoices/{id}/assignee", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + otherOrganizationUser.getUserId() + "}")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));

        assertThat(invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow().getAssignedUser()).isNull();
        assertThat(findAssignmentLogs(invoice)).isEmpty();
    }

    @Test
    void reassignsInvoiceAndKeepsPreviousAssignmentInHistory() throws Exception {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User previousAssignee = createUser(organization, true);
        User newAssignee = createUser(organization, true);
        Invoice invoice = createInvoice(organization);

        assign(invoice, previousAssignee.getUserId())
                .andExpect(status().isOk());

        assign(invoice, newAssignee.getUserId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignee.id").value(newAssignee.getUserId()))
                .andExpect(jsonPath("$.history.length()").value(2))
                .andExpect(jsonPath("$.history[1].oldValue").value(previousAssignee.getUserId().toString()))
                .andExpect(jsonPath("$.history[1].newValue").value(newAssignee.getUserId().toString()));

        Invoice persistedInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertThat(persistedInvoice.getAssignedUser().getUserId()).isEqualTo(newAssignee.getUserId());

        List<AuditLog> auditLogs = findAssignmentLogs(invoice);
        assertThat(auditLogs).hasSize(2);
        assertThat(auditLogs.get(1).getOldValue()).isEqualTo("assigneeUserId=" + previousAssignee.getUserId());
        assertThat(auditLogs.get(1).getNewValue()).isEqualTo("assigneeUserId=" + newAssignee.getUserId());
    }

    @Test
    void removesAssignmentWhenUserIdIsExplicitlyNullAndKeepsItInHistory() throws Exception {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User previousAssignee = createUser(organization, true);
        Invoice invoice = createInvoice(organization);

        assign(invoice, previousAssignee.getUserId())
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/invoices/{id}/assignee", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":null}")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignee").doesNotExist())
                .andExpect(jsonPath("$.history.length()").value(2))
                .andExpect(jsonPath("$.history[1].oldValue").value(previousAssignee.getUserId().toString()))
                .andExpect(jsonPath("$.history[1].newValue").doesNotExist());

        assertThat(invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow().getAssignedUser()).isNull();

        List<AuditLog> auditLogs = findAssignmentLogs(invoice);
        assertThat(auditLogs).hasSize(2);
        assertThat(auditLogs.get(1).getOldValue()).isEqualTo("assigneeUserId=" + previousAssignee.getUserId());
        assertThat(auditLogs.get(1).getNewValue()).isEqualTo("assigneeUserId=null");
    }

    @Test
    void rejectsMissingUserIdAndUnchangedEmptyAssignment() throws Exception {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        Invoice invoice = createInvoice(organization);

        mockMvc.perform(patch("/api/v1/invoices/{id}/assignee", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("userId is required"));

        mockMvc.perform(patch("/api/v1/invoices/{id}/assignee", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":null}")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invoice assignment is unchanged"));

        assertThat(findAssignmentLogs(invoice)).isEmpty();
    }

    private ResultActions assign(Invoice invoice, Long userId) throws Exception {
        return mockMvc.perform(patch("/api/v1/invoices/{id}/assignee", invoice.getInvoiceId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":" + userId + "}")
                .header("Authorization", "Bearer " + adminToken()));
    }

    private Invoice createInvoice(Organization organization) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setCreatedByUser(userRepository.findById(1L).orElseThrow());
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode("EXTRAITE").orElseThrow());
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private User createUser(Organization organization, boolean active) {
        User template = userRepository.findById(1L).orElseThrow();
        User user = new User();
        user.setOrganization(organization);
        user.setRole(template.getRole());
        user.setFirstName("Invoice");
        user.setLastName("Assignee");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash("not-used");
        user.setActive(active);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    private Organization createOrganization() {
        String suffix = String.valueOf(Math.floorMod(System.nanoTime(), 10_000_000_000_000L));
        Organization organization = new Organization();
        organization.setName("Other organization");
        organization.setLegalName("Other organization SAS");
        organization.setSiret("9".repeat(14 - suffix.length()) + suffix);
        organization.setEmail(UUID.randomUUID() + "@example.com");
        organization.setCreatedAt(LocalDateTime.now());
        organization.setUpdatedAt(LocalDateTime.now());
        return organizationRepository.save(organization);
    }

    private List<AuditLog> findAssignmentLogs(Invoice invoice) {
        return auditLogRepository
                .findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
                        invoice.getOrganization().getOrganizationId(),
                        Invoice.class.getSimpleName(),
                        invoice.getInvoiceId(),
                        ASSIGNEE_CHANGED
                );
    }

    private String adminToken() {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findById(1L).orElseThrow()
        );
    }
}
