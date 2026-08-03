package org.facturation.backend.service.impl;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.storage.InvoiceFileStorageService;
import org.facturation.backend.service.storage.StoredInvoiceFile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Import(InvoiceDraftWorkflowIntegrationTest.FailingOcrConfiguration.class)
class InvoiceDraftWorkflowIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    @Autowired
    InvoiceDraftWorkflowIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            InvoiceFileRepository invoiceFileRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
    }

    @Test
    void keepsIncompleteDraftWhenOcrFails() {
        long invoiceCountBeforeUpload = invoiceRepository.count();
        long invoiceFileCountBeforeUpload = invoiceFileRepository.count();
        long historyCountBeforeUpload = invoiceStatusHistoryRepository.count();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{1}
        );

        assertThrows(IllegalStateException.class, () -> invoiceService.uploadAndAnalyze(file, null));

        assertEquals(invoiceCountBeforeUpload + 1, invoiceRepository.count());
        assertEquals(invoiceFileCountBeforeUpload + 1, invoiceFileRepository.count());
        assertEquals(historyCountBeforeUpload + 2, invoiceStatusHistoryRepository.count());

        Invoice draft = invoiceRepository.findAll().stream()
                .max((first, second) -> first.getInvoiceId().compareTo(second.getInvoiceId()))
                .orElseThrow();
        assertNull(draft.getSupplier());
        assertNull(draft.getInvoiceNumber());
        assertNull(draft.getInvoiceDate());
        assertNull(draft.getTotalHt());
        assertNull(draft.getTotalTva());
        assertNull(draft.getTotalTtc());

        List<InvoiceListItemResponse> searchResults = invoiceService.searchInvoices(null, null, null);
        InvoiceListItemResponse draftResponse = searchResults.stream()
                .filter(response -> draft.getInvoiceId().equals(response.getInvoiceId()))
                .findFirst()
                .orElseThrow();
        assertEquals("OCR_EN_COURS", draftResponse.getStatus());
        assertNull(draftResponse.getSupplierName());
        assertNull(draftResponse.getInvoiceNumber());
        assertNull(draftResponse.getInvoiceDate());
        assertNull(draftResponse.getTotalTtc());

        InvoiceDetailsResponse draftDetails = invoiceService.findDetailsById(draft.getInvoiceId()).orElseThrow();
        assertNull(draftDetails.getSupplierName());
        assertNull(draftDetails.getInvoiceNumber());
        assertNull(draftDetails.getInvoiceDate());
        assertNull(draftDetails.getTotalHt());
        assertNull(draftDetails.getTotalTva());
        assertNull(draftDetails.getTotalTtc());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FailingOcrConfiguration {

        @Bean
        @Primary
        OcrClient failingOcrClient() {
            return file -> {
                throw new IllegalStateException("OCR unavailable");
            };
        }

        @Bean
        @Primary
        InvoiceFileStorageService invoiceFileStorageService() {
            return (file, invoiceId) -> new StoredInvoiceFile(
                    file.getOriginalFilename(),
                    invoiceId + "-invoice.png",
                    "test://invoices/" + invoiceId + "/invoice.png",
                    file.getContentType(),
                    file.getSize()
            );
        }
    }
}
