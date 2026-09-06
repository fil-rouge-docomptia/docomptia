package org.facturation.backend.controller;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceComment;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceCommentRepository;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class InvoiceCommentControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceCommentRepository commentRepository;

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
    void recordsTrimmedCommentWithCurrentUserAndDateAndExposesItInHistory() throws Exception {
        User author = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        Invoice invoice = createInvoice(author);

        mockMvc.perform(post("/api/v1/invoices/{id}/comments", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"  Please verify the VAT amount.  \"}")
                        .header("Authorization", "Bearer " + tokenFor(author)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.commentId").isNumber())
                .andExpect(jsonPath("$.invoiceId").value(invoice.getInvoiceId()))
                .andExpect(jsonPath("$.content").value("Please verify the VAT amount."))
                .andExpect(jsonPath("$.authorId").value(author.getUserId()))
                .andExpect(jsonPath("$.author").value("Admin Demo"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        InvoiceComment savedComment = commentRepository.findAll().getLast();
        assertThat(savedComment.getInvoice().getInvoiceId()).isEqualTo(invoice.getInvoiceId());
        assertThat(savedComment.getAuthor().getUserId()).isEqualTo(author.getUserId());
        assertThat(savedComment.getContent()).isEqualTo("Please verify the VAT amount.");
        assertThat(savedComment.getCreatedAt()).isNotNull();

        mockMvc.perform(get("/api/v1/invoices/{id}/history", invoice.getInvoiceId())
                        .header("Authorization", "Bearer " + tokenFor(author)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("COMMENT"))
                .andExpect(jsonPath("$[0].action").value("COMMENT_ADDED"))
                .andExpect(jsonPath("$[0].comment").value("Please verify the VAT amount."))
                .andExpect(jsonPath("$[0].authorId").value(author.getUserId()))
                .andExpect(jsonPath("$[0].author").value("Admin Demo"))
                .andExpect(jsonPath("$[0].date").isNotEmpty());
    }

    @Test
    void rejectsNullMissingOrBlankContentWithoutSavingComment() throws Exception {
        User author = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        Invoice invoice = createInvoice(author);
        long commentCount = commentRepository.count();

        assertInvalidComment(invoice, author, "{\"content\":null}");
        assertInvalidComment(invoice, author, "{}");
        assertInvalidComment(invoice, author, "{\"content\":\"   \\n  \"}");

        assertThat(commentRepository.count()).isEqualTo(commentCount);
    }

    @Test
    @Sql(statements = {
            "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 2",
            "ALTER TABLE users ALTER COLUMN user_id RESTART WITH 2"
    })
    void hidesInvoiceFromAnotherOrganization() throws Exception {
        User author = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        Invoice inaccessibleInvoice = createInvoice(createUser(createOrganization()));

        mockMvc.perform(post("/api/v1/invoices/{id}/comments", inaccessibleInvoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Should not be saved\"}")
                        .header("Authorization", "Bearer " + tokenFor(author)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVOICE_NOT_FOUND"));

        assertThat(commentRepository.count()).isZero();
    }

    @Test
    void requiresAuthentication() throws Exception {
        User author = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        Invoice invoice = createInvoice(author);

        mockMvc.perform(post("/api/v1/invoices/{id}/comments", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Authentication is required\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    private void assertInvalidComment(Invoice invoice, User author, String content) throws Exception {
        mockMvc.perform(post("/api/v1/invoices/{id}/comments", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(content)
                        .header("Authorization", "Bearer " + tokenFor(author)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVOICE_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Comment content is required"));
    }

    private Invoice createInvoice(User creator) {
        LocalDateTime now = LocalDateTime.now();
        Invoice invoice = new Invoice();
        invoice.setOrganization(creator.getOrganization());
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode("EXTRAITE").orElseThrow());
        invoice.setCreatedByUser(creator);
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);
        return invoiceRepository.save(invoice);
    }

    private Organization createOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("KAN-190 other organization");
        organization.setLegalName("KAN-190 Other Organization SAS");
        organization.setSiret("73282932000074");
        organization.setEmail("kan-190-other-organization@example.com");
        organization.setDefaultCurrencyCode("EUR");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        return organizationRepository.save(organization);
    }

    private User createUser(Organization organization) {
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findByCode("ADMIN").orElseThrow());
        user.setFirstName("Other");
        user.setLastName("User");
        user.setEmail("kan-190-other-user@example.com");
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
