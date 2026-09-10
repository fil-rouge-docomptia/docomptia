package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.model.ProcessingAnomalyCode;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.facturation.backend.repository.ProcessingAnomalyRepository;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.OcrSupplierResolution;
import org.facturation.backend.service.SupplierService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@Import(InvoiceOcrRetryIntegrationTest.RetryOcrConfiguration.class)
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceOcrWarningIntegrationTest {

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private OcrExtractionRepository ocrExtractionRepository;

    @Autowired
    private ProcessingAnomalyRepository processingAnomalyRepository;

    @Autowired
    private InvoiceOcrRetryIntegrationTest.ControllableOcrClient ocrClient;

    @MockitoBean
    private SupplierService supplierService;

    @Test
    void completesInvoiceAndRecordsWarningWhenOcrVatNumberIsInvalid() {
        ocrClient.makeAvailable();
        when(supplierService.resolveForInvoiceUploadWithWarnings(any(), any(), any()))
                .thenReturn(new OcrSupplierResolution(null, List.of(ProcessingAnomalyCode.INVALID_VAT)));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );

        InvoiceUploadResponse response = invoiceService.uploadAndAnalyze(file, null);

        InvoiceDetailsResponse invoice = invoiceService.findDetailsById(response.getInvoiceId()).orElseThrow();
        assertEquals("EXTRAITE", response.getStatus());
        assertEquals("EXTRAITE", invoice.getStatus());
        assertNull(invoice.getSupplier());
        assertEquals(ProcessingAnomalyCode.INVALID_VAT.getCode(), response.getWarnings().getFirst().code());
        assertTrue(processingAnomalyRepository
                .findByInvoiceInvoiceIdAndCodeAndResolvedAtIsNull(
                        response.getInvoiceId(), ProcessingAnomalyCode.INVALID_VAT
                )
                .isPresent());
        assertTrue(ocrExtractionRepository
                .findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(response.getInvoiceId())
                .isPresent());
    }
}
