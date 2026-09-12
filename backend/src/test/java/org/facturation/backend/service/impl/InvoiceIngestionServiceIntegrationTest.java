package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.InvoicePostOcrFailureException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.InvoiceOrigin;
import org.facturation.backend.model.OcrErrorCode;
import org.facturation.backend.model.OcrErrorStep;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.OcrErrorRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.InvoiceIngestionRequest;
import org.facturation.backend.service.InvoiceIngestionResult;
import org.facturation.backend.service.InvoiceIngestionService;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.storage.InvoiceFileStorageService;
import org.facturation.backend.service.storage.StoredInvoiceFile;
import org.facturation.backend.service.storage.StoredMultipartFile;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Import(InvoiceIngestionServiceIntegrationTest.IngestionStorageConfiguration.class)
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceIngestionServiceIntegrationTest {

    @Autowired
    private InvoiceService invoiceService;

    @Autowired
    private InvoiceIngestionService invoiceIngestionService;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceFileRepository invoiceFileRepository;

    @Autowired
    private InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    @Autowired
    private OcrErrorRepository ocrErrorRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ControlledInvoiceFileStorageService invoiceFileStorageService;

    @Test
    void keepsTheManualUploadContractAndPersistsItsOrigin() {
        InvoiceUploadResponse response = invoiceService.uploadAndAnalyze(invoiceFile(), null);

        assertEquals("EXTRAITE", response.getStatus());
        assertEquals(
                InvoiceOrigin.MANUAL_UPLOAD,
                invoiceRepository.findById(response.getInvoiceId()).orElseThrow().getOrigin()
        );
    }

    @Test
    void ingestsAnApprovedPlatformInvoiceWithTheSharedWorkflow() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User auditUser = userRepository.findById(1L).orElseThrow();

        InvoiceIngestionResult result = invoiceIngestionService.ingest(new InvoiceIngestionRequest(
                invoiceFile(),
                null,
                organization,
                InvoiceOrigin.APPROVED_PLATFORM,
                auditUser
        ));

        Invoice invoice = invoiceRepository.findById(result.invoice().getInvoiceId()).orElseThrow();
        assertEquals("EXTRAITE", invoiceService.findDetailsById(invoice.getInvoiceId()).orElseThrow().getStatus());
        assertEquals(InvoiceOrigin.APPROVED_PLATFORM, invoice.getOrigin());
        assertTrue(invoiceFileRepository.findByInvoiceInvoiceId(invoice.getInvoiceId()).isPresent());
        var history = invoiceStatusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        invoice.getInvoiceId(), organization.getOrganizationId()
                );
        assertEquals(
                List.of("DEPOSEE", "OCR_EN_COURS", "EXTRAITE"),
                history.stream()
                        .map(entry -> entry.getInvoiceStatus().getCode())
                        .toList()
        );
        assertTrue(history.stream().allMatch(
                entry -> auditUser.getUserId().equals(entry.getChangedByUser().getUserId())
        ));
    }

    @Test
    void recordsAStorageFailureBeforeStartingOcr() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User auditUser = userRepository.findById(1L).orElseThrow();
        invoiceFileStorageService.failNextStore();

        InvoicePostOcrFailureException exception = assertThrows(
                InvoicePostOcrFailureException.class,
                () -> invoiceIngestionService.ingest(new InvoiceIngestionRequest(
                        invoiceFile(), null, organization, InvoiceOrigin.EMAIL, auditUser
                ))
        );

        Invoice invoice = invoiceRepository.findById(exception.getInvoiceId()).orElseThrow();
        assertEquals(
                "ERREUR_TRAITEMENT",
                invoiceService.findDetailsById(invoice.getInvoiceId()).orElseThrow().getStatus()
        );
        assertEquals(OcrErrorCode.FILE_STORAGE_FAILED.getCode(), exception.getOcrError().getErrorCode());
        assertEquals(OcrErrorStep.FILE_STORAGE.name(), exception.getOcrError().getErrorStep());
        assertTrue(invoiceFileRepository.findByInvoiceInvoiceId(invoice.getInvoiceId()).isEmpty());
        assertEquals(
                OcrErrorStep.FILE_STORAGE.name(),
                ocrErrorRepository.findTopByInvoiceInvoiceIdOrderByOcrErrorIdDesc(invoice.getInvoiceId())
                        .orElseThrow()
                        .getErrorStep()
        );
    }

    private MockMultipartFile invoiceFile() {
        return new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class IngestionStorageConfiguration {

        @Bean
        @Primary
        ControlledInvoiceFileStorageService invoiceFileStorageService() {
            return new ControlledInvoiceFileStorageService();
        }
    }

    static class ControlledInvoiceFileStorageService implements InvoiceFileStorageService {

        private boolean failNextStore;

        void failNextStore() {
            failNextStore = true;
        }

        @Override
        public StoredInvoiceFile store(org.springframework.web.multipart.MultipartFile file, Long invoiceId) {
            if (failNextStore) {
                failNextStore = false;
                throw new IllegalStateException("Storage unavailable");
            }
            return new StoredInvoiceFile(
                    file.getOriginalFilename(),
                    invoiceId + "-invoice.png",
                    "test://invoices/" + invoiceId + "/invoice.png",
                    file.getContentType(),
                    file.getSize()
            );
        }

        @Override
        public org.springframework.web.multipart.MultipartFile load(InvoiceFile invoiceFile) {
            return new StoredMultipartFile(
                    invoiceFile.getOriginalFileName(),
                    invoiceFile.getMimeType(),
                    new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
            );
        }
    }
}
