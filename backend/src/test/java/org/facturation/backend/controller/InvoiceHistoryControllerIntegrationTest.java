package org.facturation.backend.controller;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
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
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceHistoryControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceService invoiceService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final OrganizationRepository organizationRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;

    @Autowired
    InvoiceHistoryControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceRepository invoiceRepository,
            InvoiceService invoiceService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            OrganizationRepository organizationRepository,
            RoleRepository roleRepository,
            UserRepository userRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceRepository = invoiceRepository;
        this.invoiceService = invoiceService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.organizationRepository = organizationRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
    }

    @Test
    void returnsStatusChangesAndCorrectionsInChronologicalOrder() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        InvoiceCorrectionRequest correctionRequest = new InvoiceCorrectionRequest();
        correctionRequest.setTotalTtc("125.50");
        invoiceService.correctInvoice(uploadResponse.getInvoiceId(), correctionRequest).orElseThrow();

        mockMvc.perform(get("/api/v1/invoices/{id}/history", uploadResponse.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].type").value("STATUS_CHANGE"))
                .andExpect(jsonPath("$[0].action").value("DEPOSEE"))
                .andExpect(jsonPath("$[1].action").value("OCR_EN_COURS"))
                .andExpect(jsonPath("$[2].action").value("EXTRAITE"))
                .andExpect(jsonPath("$[3].type").value("CORRECTION"))
                .andExpect(jsonPath("$[3].action").value("FIELD_CORRECTION"))
                .andExpect(jsonPath("$[3].fieldName").value("totalTtc"))
                .andExpect(jsonPath("$[3].oldValue").value("120.00"))
                .andExpect(jsonPath("$[3].newValue").value("125.50"))
                .andExpect(jsonPath("$[*].date", everyItem(notNullValue())))
                .andExpect(jsonPath("$[*].authorId", everyItem(notNullValue())))
                .andExpect(jsonPath("$[*].author", everyItem(notNullValue())))
                .andExpect(jsonPath("$[0].author").value("Admin Demo"));
    }

    @Test
    void returnsValidationDecisionsWithAuthorDateAndReason() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        InvoiceCorrectionRequest correctionRequest = new InvoiceCorrectionRequest();
        correctionRequest.setInvoiceDate("2026-08-07");
        invoiceService.correctInvoice(uploadResponse.getInvoiceId(), correctionRequest).orElseThrow();
        invoiceService.submitForValidation(uploadResponse.getInvoiceId()).orElseThrow();
        invoiceService.requestInvoiceCorrection(
                uploadResponse.getInvoiceId(),
                "The total amount must be checked"
        ).orElseThrow();

        mockMvc.perform(get("/api/v1/invoices/{id}/history", uploadResponse.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.type == 'VALIDATION_DECISION')]").value(hasSize(1)))
                .andExpect(jsonPath("$[?(@.type == 'VALIDATION_DECISION')].action").value("CORRECTION_REQUEST"))
                .andExpect(jsonPath("$[?(@.type == 'VALIDATION_DECISION')].comment")
                        .value("The total amount must be checked"))
                .andExpect(jsonPath("$[?(@.type == 'VALIDATION_DECISION')].authorId").value(1))
                .andExpect(jsonPath("$[?(@.type == 'VALIDATION_DECISION')].author").value("Admin Demo"))
                .andExpect(jsonPath("$[?(@.type == 'VALIDATION_DECISION')].date", everyItem(notNullValue())));
    }

    @Test
    @Sql(statements = {
            "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 2",
            "ALTER TABLE users ALTER COLUMN user_id RESTART WITH 2"
    })
    void hidesInvoicesFromAnotherOrganization() throws Exception {
        Invoice inaccessibleInvoice = createInvoiceInAnotherOrganization();

        mockMvc.perform(get("/api/v1/invoices/{id}/history", inaccessibleInvoice.getInvoiceId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVOICE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + inaccessibleInvoice.getInvoiceId() + " not found"
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
        invoice.setInvoiceStatus(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.DEPOSEE));
        invoice.setCreatedByUser(user);
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);
        return invoiceRepository.save(invoice);
    }
}
