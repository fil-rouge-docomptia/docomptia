package org.facturation.backend.service.impl;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

@SpringBootTest
@Import(InvoiceDuplicateDetectionIntegrationTest.FixedInvoiceNumberOcrConfiguration.class)
class InvoiceDuplicateDetectionIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;
    private final OrganizationRepository organizationRepository;
    private final SupplierRepository supplierRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    @Autowired
    InvoiceDuplicateDetectionIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            InvoiceStatusRepository invoiceStatusRepository,
            OrganizationRepository organizationRepository,
            SupplierRepository supplierRepository,
            UserRepository userRepository,
            JdbcTemplate jdbcTemplate
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusRepository = invoiceStatusRepository;
        this.organizationRepository = organizationRepository;
        this.supplierRepository = supplierRepository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Test
    void alertsWhenSupplierAndInvoiceNumberExactlyMatch() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        Supplier supplier = supplierRepository.findById(1L).orElseThrow();
        Invoice existingInvoice = createInvoice(organization, supplier, "KAN-94-EXACT");

        InvoiceUploadResponse response = upload("KAN-94-EXACT.png");

        assertNotNull(response.getDuplicateAlert());
        assertEquals(existingInvoice.getInvoiceId(), response.getDuplicateAlert().getExistingInvoiceId());
    }

    @Test
    void ignoresMatchingInvoiceFromAnotherOrganization() {
        Organization otherOrganization = createOrganization();
        Supplier otherSupplier = createSupplier(94L, otherOrganization, "Orange");
        createInvoice(otherOrganization, otherSupplier, "KAN-94-OTHER-ORGANIZATION");

        InvoiceUploadResponse response = upload("KAN-94-OTHER-ORGANIZATION.png");

        assertNull(response.getDuplicateAlert());
    }

    @Test
    void ignoresMatchingInvoiceNumberForAnotherSupplier() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        Supplier otherSupplier = createSupplier(95L, organization, "KAN-94 other supplier");
        createInvoice(organization, otherSupplier, "KAN-94-OTHER-SUPPLIER");

        InvoiceUploadResponse response = upload("KAN-94-OTHER-SUPPLIER.png");

        assertNull(response.getDuplicateAlert());
    }

    private InvoiceUploadResponse upload(String fileName) {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                fileName,
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );
        return invoiceService.uploadAndAnalyze(file, null);
    }

    private Invoice createInvoice(Organization organization, Supplier supplier, String invoiceNumber) {
        InvoiceStatus status = invoiceStatusRepository.findByCode("EXTRAITE").orElseThrow();
        User user = userRepository.findById(1L).orElseThrow();
        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setSupplier(supplier);
        invoice.setInvoiceStatus(status);
        invoice.setCreatedByUser(user);
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private Organization createOrganization() {
        jdbcTemplate.update(
                """
                        INSERT INTO organizations (
                            organization_id, name, legal_name, siret, email, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                94L,
                "KAN-94 other organization",
                "KAN-94 other organization",
                "99999999999999",
                "kan-94-other@example.com",
                LocalDateTime.now(),
                LocalDateTime.now()
        );
        return organizationRepository.findById(94L).orElseThrow();
    }

    private Supplier createSupplier(Long supplierId, Organization organization, String name) {
        jdbcTemplate.update(
                """
                        INSERT INTO suppliers (
                            supplier_id, organization_id, name, legal_name, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                supplierId,
                organization.getOrganizationId(),
                name,
                name + " SA",
                LocalDateTime.now(),
                LocalDateTime.now()
        );
        return supplierRepository.findById(supplierId).orElseThrow();
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedInvoiceNumberOcrConfiguration {

        @Bean
        @Primary
        OcrClient fixedInvoiceNumberOcrClient() {
            return FixedInvoiceNumberOcrConfiguration::analyze;
        }

        private static OcrAnalysisResponse analyze(MultipartFile file) {
            String fileName = file.getOriginalFilename();
            String invoiceNumber = fileName == null ? null : fileName.replaceFirst("\\.png$", "");

            OcrFieldResponse supplierField = field("supplierName", "Orange");
            OcrFieldResponse invoiceNumberField = field("invoiceNumber", invoiceNumber);

            OcrAnalysisResponse response = new OcrAnalysisResponse();
            response.setStatus("SUCCESS");
            response.setEngineName("test-ocr");
            response.setEngineVersion("1.0");
            response.setRawText("Test OCR result");
            response.setConfidenceScore("1.0");
            response.setFields(List.of(supplierField, invoiceNumberField));
            return response;
        }

        private static OcrFieldResponse field(String fieldName, String value) {
            OcrFieldResponse field = new OcrFieldResponse();
            field.setFieldName(fieldName);
            field.setRawValue(value);
            field.setNormalizedValue(value);
            field.setConfidenceScore("1.0");
            return field;
        }
    }
}
