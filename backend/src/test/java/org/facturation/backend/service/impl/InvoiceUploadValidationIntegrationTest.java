package org.facturation.backend.service.impl;

import org.facturation.backend.exception.InvalidInvoiceFileException;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
class InvoiceUploadValidationIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    @Autowired
    InvoiceUploadValidationIntegrationTest(
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
    void rejectsInvalidFileBeforeCreatingDraft() {
        long invoiceCount = invoiceRepository.count();
        long invoiceFileCount = invoiceFileRepository.count();
        long historyCount = invoiceStatusHistoryRepository.count();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                "not-an-image".getBytes()
        );

        assertThrows(InvalidInvoiceFileException.class, () -> invoiceService.uploadAndAnalyze(file, null));

        assertEquals(invoiceCount, invoiceRepository.count());
        assertEquals(invoiceFileCount, invoiceFileRepository.count());
        assertEquals(historyCount, invoiceStatusHistoryRepository.count());
    }
}
