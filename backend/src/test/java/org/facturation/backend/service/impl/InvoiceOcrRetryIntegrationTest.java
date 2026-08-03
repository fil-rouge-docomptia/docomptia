package org.facturation.backend.service.impl;

import org.facturation.backend.client.MockOcrClient;
import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceOcrFailureResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.exception.InvoiceOcrFailureException;
import org.facturation.backend.exception.OcrClientException;
import org.facturation.backend.exception.OcrRetryNotAllowedException;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.OcrErrorCode;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.OcrErrorRepository;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.storage.InvoiceFileStorageService;
import org.facturation.backend.service.storage.StoredInvoiceFile;
import org.facturation.backend.service.storage.StoredMultipartFile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Import(InvoiceOcrRetryIntegrationTest.RetryOcrConfiguration.class)
class InvoiceOcrRetryIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;
    private final OcrExtractionRepository ocrExtractionRepository;
    private final OcrErrorRepository ocrErrorRepository;
    private final ControllableOcrClient ocrClient;
    private final InMemoryInvoiceFileStorageService storageService;
    private final ApiExceptionHandler apiExceptionHandler;

    @Autowired
    InvoiceOcrRetryIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            InvoiceFileRepository invoiceFileRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository,
            OcrExtractionRepository ocrExtractionRepository,
            OcrErrorRepository ocrErrorRepository,
            ControllableOcrClient ocrClient,
            InMemoryInvoiceFileStorageService storageService,
            ApiExceptionHandler apiExceptionHandler
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
        this.ocrExtractionRepository = ocrExtractionRepository;
        this.ocrErrorRepository = ocrErrorRepository;
        this.ocrClient = ocrClient;
        this.storageService = storageService;
        this.apiExceptionHandler = apiExceptionHandler;
    }

    @Test
    void retriesOcrUsingTheExistingInvoiceAndFile() {
        long invoiceCount = invoiceRepository.count();
        long fileCount = invoiceFileRepository.count();
        long historyCount = invoiceStatusHistoryRepository.count();
        long extractionCount = ocrExtractionRepository.count();
        long errorCount = ocrErrorRepository.count();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );

        InvoiceOcrFailureException failure = assertThrows(
                InvoiceOcrFailureException.class,
                () -> invoiceService.uploadAndAnalyze(file, null)
        );
        ResponseEntity<InvoiceOcrFailureResponse> failureResponse =
                apiExceptionHandler.handleInvoiceOcrFailure(failure);

        assertEquals(HttpStatus.BAD_GATEWAY, failureResponse.getStatusCode());
        assertNotNull(failureResponse.getBody());
        assertEquals(failure.getInvoiceId(), failureResponse.getBody().getInvoiceId());
        assertEquals("ERREUR_OCR", failureResponse.getBody().getStatus());
        assertEquals(OcrErrorCode.SERVICE_UNAVAILABLE.getCode(), failureResponse.getBody().getOcrError().getCode());

        ocrClient.makeAvailable();
        InvoiceDetailsResponse response = invoiceService.retryOcr(failure.getInvoiceId()).orElseThrow();

        assertEquals(failure.getInvoiceId(), response.getInvoiceId());
        assertEquals("EXTRAITE", response.getStatus());
        assertNotNull(response.getOcrAnalysis());
        assertEquals(invoiceCount + 1, invoiceRepository.count());
        assertEquals(fileCount + 1, invoiceFileRepository.count());
        assertEquals(historyCount + 5, invoiceStatusHistoryRepository.count());
        assertEquals(extractionCount + 1, ocrExtractionRepository.count());
        assertEquals(errorCount + 1, ocrErrorRepository.count());
        assertEquals(1, storageService.getStoreCount());
        assertEquals(1, storageService.getLoadCount());

        assertThrows(
                OcrRetryNotAllowedException.class,
                () -> invoiceService.retryOcr(failure.getInvoiceId())
        );
        assertEquals(1, storageService.getLoadCount());
    }

    @Test
    void returnsEmptyWhenInvoiceDoesNotExist() {
        assertTrue(invoiceService.retryOcr(Long.MAX_VALUE).isEmpty());
    }

    static class ControllableOcrClient implements OcrClient {

        private final MockOcrClient delegate = new MockOcrClient();
        private boolean available;

        @Override
        public OcrAnalysisResponse analyze(MultipartFile file) {
            if (!available) {
                throw new OcrClientException(
                        OcrErrorCode.SERVICE_UNAVAILABLE,
                        "OCR service is unavailable"
                );
            }
            return delegate.analyze(file);
        }

        void makeAvailable() {
            available = true;
        }
    }

    static class InMemoryInvoiceFileStorageService implements InvoiceFileStorageService {

        private final Map<String, byte[]> files = new ConcurrentHashMap<>();
        private final AtomicInteger storeCount = new AtomicInteger();
        private final AtomicInteger loadCount = new AtomicInteger();

        @Override
        public StoredInvoiceFile store(MultipartFile file, Long invoiceId) {
            String storedFileName = invoiceId + "-" + file.getOriginalFilename();
            try {
                files.put(storedFileName, file.getBytes());
            } catch (IOException exception) {
                throw new IllegalStateException("Unable to store test file", exception);
            }
            storeCount.incrementAndGet();
            return new StoredInvoiceFile(
                    file.getOriginalFilename(),
                    storedFileName,
                    "memory://" + storedFileName,
                    file.getContentType(),
                    file.getSize()
            );
        }

        @Override
        public MultipartFile load(InvoiceFile invoiceFile) {
            byte[] content = Optional.ofNullable(files.get(invoiceFile.getStoredFileName()))
                    .orElseThrow(() -> new IllegalStateException("Stored test file not found"));
            loadCount.incrementAndGet();
            return new StoredMultipartFile(
                    invoiceFile.getOriginalFileName(),
                    invoiceFile.getMimeType(),
                    content
            );
        }

        int getStoreCount() {
            return storeCount.get();
        }

        int getLoadCount() {
            return loadCount.get();
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class RetryOcrConfiguration {

        @Bean
        @Primary
        ControllableOcrClient controllableOcrClient() {
            return new ControllableOcrClient();
        }

        @Bean
        @Primary
        InMemoryInvoiceFileStorageService inMemoryInvoiceFileStorageService() {
            return new InMemoryInvoiceFileStorageService();
        }
    }
}
