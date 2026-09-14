package org.facturation.backend.service.impl;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrExtraction;
import org.facturation.backend.model.OcrExtractionField;
import org.facturation.backend.model.ProcessingAnomalyCode;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.OcrExtractionFieldRepository;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Import(InvoiceMissingOcrFieldsIntegrationTest.MissingOcrConfiguration.class)
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceMissingOcrFieldsIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final OcrExtractionRepository ocrExtractionRepository;
    private final OcrExtractionFieldRepository ocrExtractionFieldRepository;
    private final OrganizationRepository organizationRepository;

    @Autowired
    InvoiceMissingOcrFieldsIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            OcrExtractionRepository ocrExtractionRepository,
            OcrExtractionFieldRepository ocrExtractionFieldRepository,
            OrganizationRepository organizationRepository
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.ocrExtractionRepository = ocrExtractionRepository;
        this.ocrExtractionFieldRepository = ocrExtractionFieldRepository;
        this.organizationRepository = organizationRepository;
    }

    @Test
    void keepsMissingOcrValuesNull() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );

        InvoiceUploadResponse uploadResponse = invoiceService.uploadAndAnalyze(file, null);
        Invoice invoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();
        OcrExtraction extraction = ocrExtractionRepository
                .findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(invoice.getInvoiceId())
                .orElseThrow();
        List<OcrExtractionField> fields = ocrExtractionFieldRepository
                .findByOcrExtractionOcrExtractionId(extraction.getOcrExtractionId());
        InvoiceDetailsResponse details = invoiceService.findDetailsById(invoice.getInvoiceId()).orElseThrow();

        assertEquals("EXTRAITE", uploadResponse.getStatus());
        assertEquals(
                List.of(ProcessingAnomalyCode.OCR_INCOMPLETE.getCode()),
                uploadResponse.getWarnings().stream().map(warning -> warning.code()).toList()
        );
        assertNull(uploadResponse.getInvoiceNumber());
        assertNull(invoice.getSupplier());
        assertNull(invoice.getInvoiceNumber());
        assertNull(invoice.getInvoiceDate());
        assertNull(invoice.getDueDate());
        assertNull(invoice.getTotalHt());
        assertNull(invoice.getTotalTva());
        assertNull(invoice.getTotalTtc());
        assertNull(extraction.getConfidenceScore());
        assertEquals(10, fields.size());
        assertTrue(fields.stream().allMatch(field ->
                field.getRawValue() == null
                        && field.getNormalizedValue() == null
                        && field.getConfidenceScore() == null
        ));
        assertNull(details.getOcrAnalysis().getConfidenceScore());
        assertTrue(details.getOcrAnalysis().getFields().stream().allMatch(field ->
                field.getRawValue() == null
                        && field.getNormalizedValue() == null
                        && field.getConfidenceScore() == null
        ));
    }

    @Test
    @Transactional
    void usesTheOrganizationsActiveDefaultCurrencyForANewInvoice() {
        var organization = organizationRepository.findById(1L).orElseThrow();
        organization.setDefaultCurrencyCode("USD");
        organizationRepository.save(organization);

        InvoiceUploadResponse uploadResponse = invoiceService.uploadAndAnalyze(invoiceFile(), null);

        Invoice invoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();
        assertEquals("USD", invoice.getCurrencyCode());
    }

    @Test
    void persistsNormalizedInternationalOcrDatesAsBackendDates() {
        InvoiceUploadResponse uploadResponse = invoiceService.uploadAndAnalyze(
                invoiceFile("international-dates.png"),
                null
        );

        Invoice invoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();
        OcrExtraction extraction = ocrExtractionRepository
                .findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(invoice.getInvoiceId())
                .orElseThrow();
        List<OcrExtractionField> fields = ocrExtractionFieldRepository
                .findByOcrExtractionOcrExtractionId(extraction.getOcrExtractionId());

        assertEquals(LocalDate.of(2026, 6, 22), invoice.getInvoiceDate());
        assertEquals(LocalDate.of(2026, 7, 31), invoice.getDueDate());
        assertDateField(fields, "invoiceDate", "June 22, 2026", "2026-06-22");
        assertDateField(fields, "dueDate", "07/31/2026", "2026-07-31");
    }

    private MockMultipartFile invoiceFile() {
        return invoiceFile("invoice.png");
    }

    private MockMultipartFile invoiceFile(String filename) {
        return new MockMultipartFile(
                "file",
                filename,
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );
    }

    private void assertDateField(
            List<OcrExtractionField> fields,
            String fieldName,
            String rawValue,
            String normalizedValue
    ) {
        OcrExtractionField field = fields.stream()
                .filter(candidate -> fieldName.equals(candidate.getFieldName()))
                .findFirst()
                .orElseThrow();
        assertEquals(rawValue, field.getRawValue());
        assertEquals(normalizedValue, field.getNormalizedValue());
    }

    static class MissingFieldsOcrClient implements OcrClient {

        private static final List<String> FIELD_NAMES = List.of(
                "supplierName",
                "siret",
                "vatNumber",
                "invoiceNumber",
                "invoiceDate",
                "dueDate",
                "commandReference",
                "totalHt",
                "totalTva",
                "totalTtc"
        );

        @Override
        public OcrAnalysisResponse analyze(MultipartFile file) {
            OcrAnalysisResponse response = new OcrAnalysisResponse();
            response.setStatus("SUCCESS");
            response.setEngineName("test-ocr");
            response.setEngineVersion("1.0");
            response.setRawText("Unstructured OCR text without extractable fields");
            response.setFields(FIELD_NAMES.stream()
                    .map(fieldName -> internationalDateField(file, fieldName))
                    .toList());
            return response;
        }

        private OcrFieldResponse internationalDateField(MultipartFile file, String fieldName) {
            if (!"international-dates.png".equals(file.getOriginalFilename())) {
                return missingField(fieldName);
            }
            return switch (fieldName) {
                case "invoiceDate" -> dateField(fieldName, "June 22, 2026", "2026-06-22");
                case "dueDate" -> dateField(fieldName, "07/31/2026", "2026-07-31");
                default -> missingField(fieldName);
            };
        }

        private OcrFieldResponse dateField(String fieldName, String rawValue, String normalizedValue) {
            OcrFieldResponse field = missingField(fieldName);
            field.setRawValue(rawValue);
            field.setNormalizedValue(normalizedValue);
            return field;
        }

        private OcrFieldResponse missingField(String fieldName) {
            OcrFieldResponse field = new OcrFieldResponse();
            field.setFieldName(fieldName);
            return field;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class MissingOcrConfiguration {

        @Bean
        @Primary
        MissingFieldsOcrClient missingFieldsOcrClient() {
            return new MissingFieldsOcrClient();
        }
    }
}
