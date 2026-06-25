package org.facturation.backend.service.impl;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.OcrExtraction;
import org.facturation.backend.model.OcrExtractionField;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OcrExtractionFieldRepository;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.storage.InvoiceFileStorageService;
import org.facturation.backend.service.storage.StoredInvoiceFile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoiceServiceImplTest {

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private SupplierRepository supplierRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private InvoiceStatusRepository invoiceStatusRepository;

    @Mock
    private InvoiceFileRepository invoiceFileRepository;

    @Mock
    private InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    @Mock
    private OcrExtractionRepository ocrExtractionRepository;

    @Mock
    private OcrExtractionFieldRepository ocrExtractionFieldRepository;

    @Mock
    private OcrClient ocrClient;

    @Mock
    private InvoiceFileStorageService invoiceFileStorageService;

    @InjectMocks
    private InvoiceServiceImpl invoiceService;

    @Test
    void uploadAndAnalyzeSavesInvoiceOcrDataAndReturnsResponse() {
        Supplier supplier = supplier();
        Organization organization = new Organization();
        User user = new User();
        InvoiceStatus depositedStatus = invoiceStatus("DEPOSEE");
        InvoiceStatus ocrInProgressStatus = invoiceStatus("OCR_EN_COURS");
        InvoiceStatus extractedStatus = invoiceStatus("EXTRAITE");
        OcrAnalysisResponse ocrAnalysis = ocrAnalysis();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.pdf",
                "application/pdf",
                "invoice content".getBytes()
        );

        when(supplierRepository.findById(1L)).thenReturn(Optional.of(supplier));
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(invoiceStatusRepository.findByCode("DEPOSEE")).thenReturn(Optional.of(depositedStatus));
        when(invoiceStatusRepository.findByCode("OCR_EN_COURS")).thenReturn(Optional.of(ocrInProgressStatus));
        when(invoiceStatusRepository.findByCode("EXTRAITE")).thenReturn(Optional.of(extractedStatus));
        when(ocrClient.analyze(file)).thenReturn(ocrAnalysis);
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> {
            Invoice invoice = invocation.getArgument(0);
            if (invoice.getInvoiceId() == null) {
                invoice.setInvoiceId(10L);
            }
            return invoice;
        });
        when(invoiceFileStorageService.store(file, 10L)).thenReturn(new StoredInvoiceFile(
                "invoice.pdf",
                "stored-invoice.pdf",
                "/tmp/facturation-files/stored-invoice.pdf",
                "application/pdf",
                file.getSize()
        ));
        when(invoiceFileRepository.save(any(InvoiceFile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ocrExtractionRepository.save(any(OcrExtraction.class))).thenAnswer(invocation -> {
            OcrExtraction extraction = invocation.getArgument(0);
            extraction.setOcrExtractionId(20L);
            return extraction;
        });

        InvoiceUploadResponse response = invoiceService.uploadAndAnalyze(file, 1L);

        assertEquals(10L, response.getInvoiceId());
        assertEquals("INV-2026-001", response.getInvoiceNumber());
        assertEquals("EXTRAITE", response.getStatus());
        assertEquals("/tmp/facturation-files/stored-invoice.pdf", response.getFilePath());
        assertSame(ocrAnalysis, response.getOcrAnalysis());

        verify(invoiceRepository, times(3)).save(any(Invoice.class));
        verify(invoiceStatusHistoryRepository, times(3)).save(any());
        verify(invoiceFileStorageService).store(file, 10L);
        verify(invoiceFileRepository).save(any(InvoiceFile.class));
        verify(ocrExtractionRepository).save(any(OcrExtraction.class));
        verify(ocrExtractionFieldRepository, times(5)).save(any(OcrExtractionField.class));
    }

    @Test
    void findDetailsByIdReturnsInvoiceFileAndLatestOcrAnalysis() {
        Invoice invoice = invoice();
        InvoiceFile invoiceFile = new InvoiceFile();
        invoiceFile.setFilePath("/tmp/facturation-files/invoice.pdf");
        OcrExtraction ocrExtraction = new OcrExtraction();
        ocrExtraction.setOcrExtractionId(20L);
        ocrExtraction.setStatus("SUCCESS");
        ocrExtraction.setRawText("OCR raw text");
        ocrExtraction.setConfidenceScore(new BigDecimal("0.92"));
        OcrExtractionField field = new OcrExtractionField();
        field.setFieldName("invoiceNumber");
        field.setRawValue("INV-2026-001");
        field.setNormalizedValue("INV-2026-001");
        field.setConfidenceScore(new BigDecimal("0.93"));

        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));
        when(invoiceFileRepository.findByInvoiceInvoiceId(10L)).thenReturn(Optional.of(invoiceFile));
        when(ocrExtractionRepository.findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(10L))
                .thenReturn(Optional.of(ocrExtraction));
        when(ocrExtractionFieldRepository.findByOcrExtractionOcrExtractionId(20L)).thenReturn(List.of(field));

        Optional<InvoiceDetailsResponse> result = invoiceService.findDetailsById(10L);

        assertTrue(result.isPresent());
        InvoiceDetailsResponse response = result.orElseThrow();
        assertEquals(10L, response.getInvoiceId());
        assertEquals("INV-2026-001", response.getInvoiceNumber());
        assertEquals("EXTRAITE", response.getStatus());
        assertEquals("Orange", response.getSupplierName());
        assertEquals("EUR", response.getCurrencyCode());
        assertEquals("100.00", response.getTotalHt());
        assertEquals("20.00", response.getTotalTva());
        assertEquals("120.00", response.getTotalTtc());
        assertEquals("/tmp/facturation-files/invoice.pdf", response.getFilePath());
        assertEquals("SUCCESS", response.getOcrAnalysis().getStatus());
        assertEquals(1, response.getOcrAnalysis().getFields().size());
    }

    @Test
    void findAllReturnsInvoicesFromRepository() {
        Invoice invoice = new Invoice();
        when(invoiceRepository.findAll()).thenReturn(List.of(invoice));

        List<Invoice> invoices = invoiceService.findAll();

        assertEquals(1, invoices.size());
        assertSame(invoice, invoices.get(0));
        verify(invoiceRepository).findAll();
    }

    @Test
    void findByIdReturnsInvoiceFromRepository() {
        Invoice invoice = new Invoice();
        when(invoiceRepository.findById(10L)).thenReturn(Optional.of(invoice));

        Optional<Invoice> result = invoiceService.findById(10L);

        assertSame(invoice, result.orElseThrow());
        verify(invoiceRepository).findById(10L);
    }

    @Test
    void saveDelegatesToRepository() {
        Invoice invoice = new Invoice();
        when(invoiceRepository.save(invoice)).thenReturn(invoice);

        Invoice savedInvoice = invoiceService.save(invoice);

        assertSame(invoice, savedInvoice);
        verify(invoiceRepository).save(invoice);
    }

    private Invoice invoice() {
        Invoice invoice = new Invoice();
        invoice.setInvoiceId(10L);
        invoice.setInvoiceNumber("INV-2026-001");
        invoice.setInvoiceStatus(invoiceStatus("EXTRAITE"));
        invoice.setSupplier(supplier());
        invoice.setCurrencyCode("EUR");
        invoice.setTotalHt(new BigDecimal("100.00"));
        invoice.setTotalTva(new BigDecimal("20.00"));
        invoice.setTotalTtc(new BigDecimal("120.00"));
        return invoice;
    }

    private Supplier supplier() {
        Supplier supplier = new Supplier();
        supplier.setSupplierId(1L);
        supplier.setName("Orange");
        return supplier;
    }

    private InvoiceStatus invoiceStatus(String code) {
        InvoiceStatus status = new InvoiceStatus();
        status.setCode(code);
        status.setLabel(code);
        return status;
    }

    private OcrAnalysisResponse ocrAnalysis() {
        OcrAnalysisResponse response = new OcrAnalysisResponse();
        response.setStatus("SUCCESS");
        response.setRawText("OCR raw text");
        response.setConfidenceScore("0.92");
        response.setFields(List.of(
                ocrField("supplierName", "Orange", "Orange SA", "0.95"),
                ocrField("invoiceNumber", "INV-2026-001", "INV-2026-001", "0.93"),
                ocrField("totalHt", "100.00", "100.00", "0.90"),
                ocrField("totalTva", "20.00", "20.00", "0.90"),
                ocrField("totalTtc", "120.00", "120.00", "0.92")
        ));
        return response;
    }

    private OcrFieldResponse ocrField(String fieldName, String rawValue, String normalizedValue, String confidenceScore) {
        OcrFieldResponse field = new OcrFieldResponse();
        field.setFieldName(fieldName);
        field.setRawValue(rawValue);
        field.setNormalizedValue(normalizedValue);
        field.setConfidenceScore(confidenceScore);
        return field;
    }
}
