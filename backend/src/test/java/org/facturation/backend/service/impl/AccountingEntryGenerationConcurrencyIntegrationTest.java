package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.concurrent.DelegatingSecurityContextExecutorService;
import org.springframework.test.annotation.DirtiesContext;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class AccountingEntryGenerationConcurrencyIntegrationTest {

    private static final int CONCURRENT_CALL_COUNT = 4;

    private final InvoiceService invoiceService;
    private final AccountingEntryRepository accountingEntryRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;

    @Autowired
    AccountingEntryGenerationConcurrencyIntegrationTest(
            InvoiceService invoiceService,
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository
    ) {
        this.invoiceService = invoiceService;
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
    }

    @Test
    void concurrentGenerationReturnsOneAccountingEntryWithoutDuplicatingLines() throws Exception {
        Long invoiceId = createValidatedInvoice();
        long accountingEntryCountBefore = accountingEntryRepository.count();
        long accountingEntryLineCountBefore = accountingEntryLineRepository.count();
        CountDownLatch ready = new CountDownLatch(CONCURRENT_CALL_COUNT);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = new DelegatingSecurityContextExecutorService(
                Executors.newFixedThreadPool(CONCURRENT_CALL_COUNT)
        )) {
            List<Future<InvoiceAccountingEntryResponse>> futures = new ArrayList<>();
            for (int call = 0; call < CONCURRENT_CALL_COUNT; call++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return invoiceService.generateAccountingEntry(invoiceId).orElseThrow();
                }));
            }
            ready.await();
            start.countDown();

            List<Long> accountingEntryIds = new ArrayList<>();
            for (Future<InvoiceAccountingEntryResponse> future : futures) {
                accountingEntryIds.add(future.get().getAccountingEntry().getAccountingEntryId());
            }

            assertEquals(1, accountingEntryIds.stream().distinct().count());
        }

        assertEquals(accountingEntryCountBefore + 1, accountingEntryRepository.count());
        assertEquals(accountingEntryLineCountBefore + 3, accountingEntryLineRepository.count());
    }

    private Long createValidatedInvoice() {
        InvoiceUploadResponse uploadResponse = invoiceService.uploadAndAnalyze(new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        ), null);
        InvoiceCorrectionRequest correctionRequest = new InvoiceCorrectionRequest();
        correctionRequest.setInvoiceDate("2026-08-07");
        invoiceService.correctInvoice(uploadResponse.getInvoiceId(), correctionRequest).orElseThrow();
        invoiceService.submitForValidation(uploadResponse.getInvoiceId()).orElseThrow();
        invoiceService.validateInvoice(uploadResponse.getInvoiceId()).orElseThrow();
        return uploadResponse.getInvoiceId();
    }
}
