package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceOcrFailureResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.exception.InvoicePostOcrFailureException;
import org.facturation.backend.model.OcrErrorCode;
import org.facturation.backend.model.OcrErrorStep;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.OcrErrorRepository;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.OcrSupplierResolution;
import org.facturation.backend.service.SupplierService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@Import(InvoiceOcrRetryIntegrationTest.RetryOcrConfiguration.class)
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoicePostOcrFailureIntegrationTest {

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private OcrErrorRepository ocrErrorRepository;

    @Autowired
    private InvoiceOcrRetryIntegrationTest.ControllableOcrClient ocrClient;

    @Autowired
    private ApiExceptionHandler apiExceptionHandler;

    @MockitoBean
    private SupplierService supplierService;

    @Test
    void recordsSupplierResolutionFailureAndAllowsRetry() {
        ocrClient.makeAvailable();
        when(supplierService.resolveForInvoiceUploadWithWarnings(any(), any(), any()))
                .thenThrow(new IllegalStateException("database password must not be exposed"));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );

        InvoicePostOcrFailureException failure = assertThrows(
                InvoicePostOcrFailureException.class,
                () -> invoiceService.uploadAndAnalyze(file, null)
        );
        ResponseEntity<InvoiceOcrFailureResponse> failureResponse =
                apiExceptionHandler.handleInvoicePostOcrFailure(failure);

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, failureResponse.getStatusCode());
        assertNotNull(failureResponse.getBody());
        assertEquals(failure.getInvoiceId(), failureResponse.getBody().getInvoiceId());
        assertEquals("ERREUR_TRAITEMENT", failureResponse.getBody().getStatus());
        assertEquals(
                OcrErrorCode.SUPPLIER_RESOLUTION_FAILED.getCode(),
                failureResponse.getBody().getOcrError().getCode()
        );
        assertEquals(
                OcrErrorStep.SUPPLIER_RESOLUTION.name(),
                failureResponse.getBody().getOcrError().getStep()
        );
        assertFalse(failureResponse.getBody().getOcrError().getMessage().contains("password"));
        assertEquals(
                "ERREUR_TRAITEMENT",
                invoiceRepository.findById(failure.getInvoiceId()).orElseThrow().getInvoiceStatus().getCode()
        );
        assertEquals(
                OcrErrorStep.SUPPLIER_RESOLUTION.name(),
                ocrErrorRepository.findTopByInvoiceInvoiceIdOrderByOcrErrorIdDesc(failure.getInvoiceId())
                        .orElseThrow()
                        .getErrorStep()
        );

        when(supplierService.resolveForInvoiceUploadWithWarnings(any(), any(), any()))
                .thenReturn(new OcrSupplierResolution(null, List.of()));
        InvoiceDetailsResponse retriedInvoice = invoiceService.retryOcr(failure.getInvoiceId()).orElseThrow();

        assertEquals("EXTRAITE", retriedInvoice.getStatus());
    }
}
