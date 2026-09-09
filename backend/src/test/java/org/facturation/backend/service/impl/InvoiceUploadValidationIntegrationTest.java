package org.facturation.backend.service.impl;

import org.facturation.backend.exception.InvalidInvoiceFileException;
import org.facturation.backend.exception.SubscriptionLimitExceededException;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.OrganizationSubscriptionRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Transactional
class InvoiceUploadValidationIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;
    private final OrganizationSubscriptionRepository organizationSubscriptionRepository;

    @Autowired
    InvoiceUploadValidationIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            InvoiceFileRepository invoiceFileRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository,
            OrganizationSubscriptionRepository organizationSubscriptionRepository
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
        this.organizationSubscriptionRepository = organizationSubscriptionRepository;
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

    @Test
    @WithMockUser(username = "admin@facturation-demo.fr")
    void rejectsUploadAtMonthlyLimitBeforeCreatingAnyInvoiceData() {
        long invoiceCount = invoiceRepository.count();
        long invoiceFileCount = invoiceFileRepository.count();
        long historyCount = invoiceStatusHistoryRepository.count();
        YearMonth currentMonth = YearMonth.now();
        int monthlyUsage = Math.toIntExact(invoiceRepository
                .countByOrganizationOrganizationIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        1L,
                        currentMonth.atDay(1).atStartOfDay(),
                        currentMonth.plusMonths(1).atDay(1).atStartOfDay()
                ));
        var subscription = organizationSubscriptionRepository.findByOrganizationOrganizationId(1L).orElseThrow();
        subscription.getPlan().findLimitsAt(LocalDate.now()).orElseThrow().setMonthlyInvoiceLimit(monthlyUsage);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );

        SubscriptionLimitExceededException exception = assertThrows(
                SubscriptionLimitExceededException.class,
                () -> invoiceService.uploadAndAnalyze(file, null)
        );

        assertEquals("MONTHLY_INVOICE_LIMIT", exception.getLimit());
        assertEquals(monthlyUsage, exception.getQuota());
        assertEquals(monthlyUsage, exception.getUsage());
        assertEquals(invoiceCount, invoiceRepository.count());
        assertEquals(invoiceFileCount, invoiceFileRepository.count());
        assertEquals(historyCount, invoiceStatusHistoryRepository.count());
    }
}
