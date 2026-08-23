package org.facturation.backend.controller;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceStatusResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.repository.InvoiceValidationDecisionRepository;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.contains;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceCorrectionControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final OrganizationRepository organizationRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final InvoiceValidationDecisionRepository validationDecisionRepository;

    @Autowired
    InvoiceCorrectionControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            OrganizationRepository organizationRepository,
            RoleRepository roleRepository,
            UserRepository userRepository,
            InvoiceValidationDecisionRepository validationDecisionRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.organizationRepository = organizationRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.validationDecisionRepository = validationDecisionRepository;
    }

    @Test
    void correctsInvoiceThroughPatchEndpoint() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();

        mockMvc.perform(patch("/api/v1/invoices/{id}", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "invoiceDate": "2026-08-07",
                                  "totalTtc": "125.50"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(uploadResponse.getInvoiceId()))
                .andExpect(jsonPath("$.status").value("EXTRAITE"))
                .andExpect(jsonPath("$.invoiceDate").value("2026-08-07"))
                .andExpect(jsonPath("$.totalTtc").value("125.50"))
                .andExpect(jsonPath("$.ocrAnalysis.fields[?(@.fieldName=='invoiceDate')].corrected", contains(true)))
                .andExpect(jsonPath("$.ocrAnalysis.fields[?(@.fieldName=='totalTtc')].corrected", contains(true)))
                .andExpect(jsonPath("$.ocrAnalysis.fields[?(@.fieldName=='supplierName')].corrected", contains(false)));
    }

    @Test
    void returnsExplicitBadRequestWhenCorrectionPayloadIsInvalid() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();

        mockMvc.perform(patch("/api/v1/invoices/{id}", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "invoiceNumber": " "
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVOICE_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("invoiceNumber is required"));
    }

    @Test
    void returnsNormalizedNotFoundWhenInvoiceDoesNotExist() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/{id}", Long.MAX_VALUE))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVOICE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Invoice " + Long.MAX_VALUE + " not found"));
    }

    @Test
    @Sql(statements = {
            "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 2",
            "ALTER TABLE users ALTER COLUMN user_id RESTART WITH 2"
    })
    void doesNotCorrectInvoiceFromAnotherOrganization() throws Exception {
        Invoice inaccessibleInvoice = createInvoiceInAnotherOrganization();

        mockMvc.perform(patch("/api/v1/invoices/{id}", inaccessibleInvoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "invoiceNumber": "OTHER-002"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVOICE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + inaccessibleInvoice.getInvoiceId() + " not found"
                ));

        Invoice persistedInvoice = invoiceRepository.findById(inaccessibleInvoice.getInvoiceId()).orElseThrow();
        assertEquals("OTHER-001", persistedInvoice.getInvoiceNumber());
        assertEquals("EXTRAITE", persistedInvoice.getInvoiceStatus().getCode());
    }

    @Test
    @Sql(statements = {
            "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 2",
            "ALTER TABLE users ALTER COLUMN user_id RESTART WITH 2"
    })
    void doesNotReturnInvoiceDetailsFromAnotherOrganization() throws Exception {
        Invoice inaccessibleInvoice = createInvoiceInAnotherOrganization();

        mockMvc.perform(get("/api/v1/invoices/{id}", inaccessibleInvoice.getInvoiceId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVOICE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + inaccessibleInvoice.getInvoiceId() + " not found"
                ));
    }

    @Test
    void returnsNormalizedConflictWhenCorrectionIsForbidden() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        mockMvc.perform(patch("/api/v1/invoices/{id}", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "invoiceDate": "2026-08-07"
                                }
                                """))
                .andExpect(status().isOk());
        invoiceService.submitForValidation(uploadResponse.getInvoiceId()).orElseThrow();
        InvoiceStatusResponse validationResponse = invoiceService.validateInvoice(uploadResponse.getInvoiceId()).orElseThrow();

        mockMvc.perform(patch("/api/v1/invoices/{id}", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "invoiceNumber": "INV-LOCKED-001"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVOICE_ACTION_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + validationResponse.getInvoiceId()
                                + " cannot be corrected from status VALIDEE"
                ));
    }

    @Test
    void rejectsInvoiceWithMandatoryReason() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        submitCompleteInvoiceForValidation(uploadResponse.getInvoiceId());

        mockMvc.perform(post("/api/v1/invoices/{id}/reject", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reason": "The extracted total is incorrect"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(uploadResponse.getInvoiceId()))
                .andExpect(jsonPath("$.status").value("REJETEE"));

        var decisions = validationDecisionRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByDecidedAtAscInvoiceValidationDecisionIdAsc(
                        uploadResponse.getInvoiceId(),
                        1L
                );
        assertEquals(1, decisions.size());
        assertEquals("REJECTION", decisions.getFirst().getDecisionType().name());
        assertEquals("The extracted total is incorrect", decisions.getFirst().getReason());
    }

    @Test
    void returnsBadRequestWhenRejectionReasonIsBlank() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        submitCompleteInvoiceForValidation(uploadResponse.getInvoiceId());

        mockMvc.perform(post("/api/v1/invoices/{id}/reject", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reason": " "
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVOICE_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Rejection reason is required"));
    }

    @Test
    void refusesRejectionBeforeSubmissionWithoutChangingStatus() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();

        mockMvc.perform(post("/api/v1/invoices/{id}/reject", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reason": "The extracted total is incorrect"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVOICE_ACTION_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + uploadResponse.getInvoiceId() + " cannot be rejected from status EXTRAITE"
                ));
    }

    @Test
    void submitsInvoiceForValidation() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        mockMvc.perform(patch("/api/v1/invoices/{id}", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "invoiceDate": "2026-08-07"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                        "/api/v1/invoices/{id}/submit-for-validation",
                        uploadResponse.getInvoiceId()
                ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(uploadResponse.getInvoiceId()))
                .andExpect(jsonPath("$.status").value("A_VERIFIER"));
    }

    @Test
    void returnsExplicitErrorWhenSubmittedInvoiceIsIncomplete() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();

        mockMvc.perform(post(
                        "/api/v1/invoices/{id}/submit-for-validation",
                        uploadResponse.getInvoiceId()
                ))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVOICE_REQUIRED_FIELDS_MISSING"))
                .andExpect(jsonPath("$.missingFields").isArray())
                .andExpect(jsonPath("$.missingFields.length()").value(1))
                .andExpect(jsonPath("$.missingFields[0]").value("invoiceDate"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + uploadResponse.getInvoiceId()
                                + " cannot be submitted for validation from status EXTRAITE"
                                + " because required fields are missing: invoiceDate"
                ));
    }

    private InvoiceUploadResponse uploadInvoice() {
        return invoiceService.uploadAndAnalyze(new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        ), null);
    }

    private void submitCompleteInvoiceForValidation(Long invoiceId) {
        InvoiceCorrectionRequest request = new InvoiceCorrectionRequest();
        request.setInvoiceDate("2026-08-07");
        invoiceService.correctInvoice(invoiceId, request).orElseThrow();
        invoiceService.submitForValidation(invoiceId).orElseThrow();
    }

    private Invoice createInvoiceInAnotherOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("Other organization");
        organization.setLegalName("Other organization SAS");
        organization.setSiret("99999999999999");
        organization.setEmail("other-organization@example.com");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        organization = organizationRepository.save(organization);

        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findById(1L).orElseThrow());
        user.setFirstName("Other");
        user.setLastName("User");
        user.setEmail("other-user@example.com");
        user.setPasswordHash("not-used");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        user = userRepository.save(user);

        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setInvoiceStatus(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.EXTRAITE));
        invoice.setCreatedByUser(user);
        invoice.setInvoiceNumber("OTHER-001");
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);
        return invoiceRepository.save(invoice);
    }
}
