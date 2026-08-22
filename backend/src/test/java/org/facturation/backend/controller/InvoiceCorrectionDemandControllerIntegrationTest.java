package org.facturation.backend.controller;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.InvoiceStatusHistory;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class InvoiceCorrectionDemandControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceService invoiceService;
    private final InvoiceStatusHistoryRepository statusHistoryRepository;

    @Autowired
    InvoiceCorrectionDemandControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceRepository invoiceRepository,
            InvoiceService invoiceService,
            InvoiceStatusHistoryRepository statusHistoryRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceRepository = invoiceRepository;
        this.invoiceService = invoiceService;
        this.statusHistoryRepository = statusHistoryRepository;
    }

    @Test
    void requestsCorrectionAndReturnsInvoiceToCorrectionWorkflow() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoiceAwaitingDecision();

        mockMvc.perform(post("/api/v1/invoices/{id}/request-correction", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason": "  The total amount must be checked  "}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(uploadResponse.getInvoiceId()))
                .andExpect(jsonPath("$.status").value("EXTRAITE"));

        assertEquals("EXTRAITE", currentStatus(uploadResponse.getInvoiceId()));
        List<InvoiceStatusHistory> history = statusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        uploadResponse.getInvoiceId(),
                        1L
                );
        InvoiceStatusHistory correctionRequest = history.get(history.size() - 1);
        assertEquals("EXTRAITE", correctionRequest.getInvoiceStatus().getCode());
        assertEquals("The total amount must be checked", correctionRequest.getComment());

        InvoiceCorrectionRequest correction = new InvoiceCorrectionRequest();
        correction.setTotalTtc("121.00");
        invoiceService.correctInvoice(uploadResponse.getInvoiceId(), correction).orElseThrow();
        assertEquals(
                "A_VERIFIER",
                invoiceService.submitForValidation(uploadResponse.getInvoiceId()).orElseThrow().getStatus()
        );
    }

    @Test
    void requiresCorrectionReasonWithoutChangingInvoice() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoiceAwaitingDecision();
        long historyCount = statusHistoryRepository.count();

        mockMvc.perform(post("/api/v1/invoices/{id}/request-correction", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVOICE_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Correction request reason is required"));

        assertEquals("A_VERIFIER", currentStatus(uploadResponse.getInvoiceId()));
        assertEquals(historyCount, statusHistoryRepository.count());
    }

    @Test
    void refusesCorrectionRequestWhenInvoiceIsNotAwaitingDecision() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice();

        mockMvc.perform(post("/api/v1/invoices/{id}/request-correction", uploadResponse.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"The total amount must be checked\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVOICE_ACTION_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + uploadResponse.getInvoiceId()
                                + " cannot receive a correction request from status EXTRAITE"
                ));

        assertEquals("EXTRAITE", currentStatus(uploadResponse.getInvoiceId()));
    }

    private InvoiceUploadResponse uploadInvoiceAwaitingDecision() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        InvoiceCorrectionRequest correction = new InvoiceCorrectionRequest();
        correction.setInvoiceDate("2026-08-07");
        invoiceService.correctInvoice(uploadResponse.getInvoiceId(), correction).orElseThrow();
        invoiceService.submitForValidation(uploadResponse.getInvoiceId()).orElseThrow();
        return uploadResponse;
    }

    private InvoiceUploadResponse uploadInvoice() {
        return invoiceService.uploadAndAnalyze(new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        ), null);
    }

    private String currentStatus(Long invoiceId) {
        return invoiceRepository.findById(invoiceId).orElseThrow().getInvoiceStatus().getCode();
    }
}
