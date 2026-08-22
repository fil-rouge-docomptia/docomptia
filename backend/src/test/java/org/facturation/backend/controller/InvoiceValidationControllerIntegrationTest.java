package org.facturation.backend.controller;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceValidationDecisionRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class InvoiceValidationControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceService invoiceService;
    private final InvoiceValidationDecisionRepository validationDecisionRepository;

    @Autowired
    InvoiceValidationControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceRepository invoiceRepository,
            InvoiceService invoiceService,
            InvoiceValidationDecisionRepository validationDecisionRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceRepository = invoiceRepository;
        this.invoiceService = invoiceService;
        this.validationDecisionRepository = validationDecisionRepository;
    }

    @Test
    void validatesInvoiceAwaitingDecision() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        submitForValidation(uploadResponse.getInvoiceId());

        mockMvc.perform(post("/api/v1/invoices/{id}/validate", uploadResponse.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(uploadResponse.getInvoiceId()))
                .andExpect(jsonPath("$.status").value("VALIDEE"));

        String persistedStatus = invoiceRepository.findById(uploadResponse.getInvoiceId())
                .orElseThrow()
                .getInvoiceStatus()
                .getCode();
        assertEquals("VALIDEE", persistedStatus);
        var decisions = validationDecisionRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByDecidedAtAscInvoiceValidationDecisionIdAsc(
                        uploadResponse.getInvoiceId(),
                        1L
                );
        assertEquals(1, decisions.size());
        assertEquals("VALIDATION", decisions.getFirst().getDecisionType().name());
        assertEquals(1L, decisions.getFirst().getDecidedByUser().getUserId());
        assertEquals(null, decisions.getFirst().getReason());
    }

    @Test
    void refusesValidationWhenInvoiceIsNotAwaitingDecision() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();

        mockMvc.perform(post("/api/v1/invoices/{id}/validate", uploadResponse.getInvoiceId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVOICE_ACTION_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + uploadResponse.getInvoiceId()
                                + " cannot be validated from status EXTRAITE"
                ));
    }

    private void submitForValidation(Long invoiceId) {
        InvoiceCorrectionRequest correctionRequest = new InvoiceCorrectionRequest();
        correctionRequest.setInvoiceDate("2026-08-07");
        invoiceService.correctInvoice(invoiceId, correctionRequest).orElseThrow();
        invoiceService.submitForValidation(invoiceId).orElseThrow();
    }

    private InvoiceUploadResponse uploadInvoice() {
        return invoiceService.uploadAndAnalyze(new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        ), null);
    }
}
