package org.facturation.backend.service.impl;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.model.DuplicateAlertType;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.repository.InvoiceDuplicateAlertRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.InvoiceDuplicateAlertService;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Import(InvoiceDuplicateAlertIntegrationTest.DuplicateOcrConfiguration.class)
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceDuplicateAlertIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceDuplicateAlertService duplicateAlertService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceDuplicateAlertRepository duplicateAlertRepository;

    @Autowired
    InvoiceDuplicateAlertIntegrationTest(
            InvoiceService invoiceService,
            InvoiceDuplicateAlertService duplicateAlertService,
            InvoiceRepository invoiceRepository,
            InvoiceDuplicateAlertRepository duplicateAlertRepository
    ) {
        this.invoiceService = invoiceService;
        this.duplicateAlertService = duplicateAlertService;
        this.invoiceRepository = invoiceRepository;
        this.duplicateAlertRepository = duplicateAlertRepository;
    }

    @Test
    void createsACertainAlertForTheSameSupplierAndExactInvoiceNumber() {
        InvoiceUploadResponse first = invoiceService.uploadAndAnalyze(invoiceFile("exact-first.png"), 1L);
        InvoiceUploadResponse second = invoiceService.uploadAndAnalyze(invoiceFile("exact-second.png"), 1L);

        List<InvoiceDuplicateAlert> alerts = duplicateAlertRepository
                .findByInvoiceInvoiceIdOrderByCreatedAtAsc(second.getInvoiceId());

        assertEquals(1, alerts.size());
        assertEquals(DuplicateAlertType.CERTAIN, alerts.getFirst().getAlertType());
        assertEquals(first.getInvoiceId(), alerts.getFirst().getMatchingInvoice().getInvoiceId());
        assertEquals("EXACT-001", second.getDuplicateAlerts().getFirst().getMatchingInvoiceNumber());
        assertEquals(first.getInvoiceId(), second.getDuplicateAlerts().getFirst().getMatchingInvoiceId());
        assertEquals("CERTAIN", second.getDuplicateAlerts().getFirst().getConfidenceLevel());
        assertEquals(alerts.getFirst().getCreatedAt().toString(), second.getDuplicateAlerts().getFirst().getCreatedAt());
    }

    @Test
    void doesNotMatchAnExactInvoiceNumberAcrossOrganizations() {
        invoiceService.uploadAndAnalyze(invoiceFile("tenant-first.png"), 1L);
        Organization otherOrganization = otherOrganization();
        Supplier otherSupplier = otherSupplier(otherOrganization);
        Invoice otherInvoice = otherInvoice(otherOrganization, otherSupplier);

        duplicateAlertService.detectDuplicates(otherInvoice);

        assertTrue(duplicateAlertRepository
                .findByInvoiceInvoiceIdOrderByCreatedAtAsc(otherInvoice.getInvoiceId())
                .isEmpty());
    }

    @Test
    void createsAProbableAlertWithCriteriaWithoutDiscardingTheInvoice() {
        InvoiceUploadResponse first = invoiceService.uploadAndAnalyze(invoiceFile("first.png"), 1L);
        InvoiceUploadResponse second = invoiceService.uploadAndAnalyze(invoiceFile("second.png"), 1L);

        List<InvoiceDuplicateAlert> alerts = duplicateAlertRepository
                .findByInvoiceInvoiceIdOrderByCreatedAtAsc(second.getInvoiceId());
        InvoiceDetailsResponse details = invoiceService.findDetailsById(second.getInvoiceId()).orElseThrow();

        assertTrue(first.getDuplicateAlerts().isEmpty());
        assertEquals("EXTRAITE", second.getStatus());
        assertEquals(1, alerts.size());
        assertEquals(DuplicateAlertType.PROBABLE, alerts.getFirst().getAlertType());
        assertEquals(first.getInvoiceId(), alerts.getFirst().getMatchingInvoice().getInvoiceId());
        assertEquals(1L, alerts.getFirst().getSupplier().getSupplierId());
        assertEquals(LocalDate.of(2099, 12, 31), alerts.getFirst().getInvoiceDate());
        assertEquals(0, new BigDecimal("456.78").compareTo(alerts.getFirst().getTotalTtc()));
        assertEquals(1, second.getDuplicateAlerts().size());
        assertEquals("PROBABLE", second.getDuplicateAlerts().getFirst().getType());
        assertEquals("PROBABLE", details.getDuplicateAlerts().getFirst().getConfidenceLevel());
        assertEquals(alerts.getFirst().getCreatedAt().toString(), details.getDuplicateAlerts().getFirst().getCreatedAt());
        assertEquals(1, details.getDuplicateAlerts().size());
        assertTrue(invoiceRepository.existsById(second.getInvoiceId()));
    }

    private MockMultipartFile invoiceFile(String filename) {
        return new MockMultipartFile(
                "file",
                filename,
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );
    }

    private Organization otherOrganization() {
        Organization organization = new Organization();
        organization.setOrganizationId(94L);
        return organization;
    }

    private Supplier otherSupplier(Organization organization) {
        Supplier supplier = new Supplier();
        supplier.setSupplierId(94L);
        supplier.setOrganization(organization);
        return supplier;
    }

    private Invoice otherInvoice(Organization organization, Supplier supplier) {
        Invoice invoice = new Invoice();
        invoice.setInvoiceId(94L);
        invoice.setOrganization(organization);
        invoice.setSupplier(supplier);
        invoice.setInvoiceNumber("TENANT-001");
        return invoice;
    }

    static class DuplicateOcrClient implements OcrClient {

        private final AtomicInteger invoiceSequence = new AtomicInteger();

        @Override
        public OcrAnalysisResponse analyze(MultipartFile file) {
            OcrAnalysisResponse response = new OcrAnalysisResponse();
            response.setStatus("SUCCESS");
            response.setEngineName("duplicate-test-ocr");
            response.setEngineVersion("1.0");
            if (file.getOriginalFilename().startsWith("exact-")) {
                response.setFields(List.of(field("invoiceNumber", "EXACT-001")));
                return response;
            }
            if (file.getOriginalFilename().startsWith("tenant-")) {
                response.setFields(List.of(field("invoiceNumber", "TENANT-001")));
                return response;
            }
            response.setFields(List.of(
                    field("invoiceNumber", "TEST-" + invoiceSequence.incrementAndGet()),
                    field("invoiceDate", "2099-12-31"),
                    field("totalTtc", "456.78")
            ));
            return response;
        }

        private OcrFieldResponse field(String name, String value) {
            OcrFieldResponse field = new OcrFieldResponse();
            field.setFieldName(name);
            field.setRawValue(value);
            field.setNormalizedValue(value);
            return field;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class DuplicateOcrConfiguration {

        @Bean
        @Primary
        DuplicateOcrClient duplicateOcrClient() {
            return new DuplicateOcrClient();
        }
    }
}
