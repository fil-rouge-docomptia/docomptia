package org.facturation.backend.controller;

import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class InvoiceCorrectionControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceService invoiceService;

    @Autowired
    InvoiceCorrectionControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceService invoiceService
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceService = invoiceService;
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
                .andExpect(jsonPath("$.message").value("invoiceNumber is required"));
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
