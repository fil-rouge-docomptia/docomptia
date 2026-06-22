package org.facturation.backend.service.impl;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusHistory;
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
import org.facturation.backend.service.InvoiceService;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class InvoiceServiceImpl implements InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final SupplierRepository supplierRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;
    private final OcrExtractionRepository ocrExtractionRepository;
    private final OcrExtractionFieldRepository ocrExtractionFieldRepository;
    private final OcrClient ocrClient;

    public InvoiceServiceImpl(
            InvoiceRepository invoiceRepository,
            SupplierRepository supplierRepository,
            OrganizationRepository organizationRepository,
            UserRepository userRepository,
            InvoiceStatusRepository invoiceStatusRepository,
            InvoiceFileRepository invoiceFileRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository,
            OcrExtractionRepository ocrExtractionRepository,
            OcrExtractionFieldRepository ocrExtractionFieldRepository,
            OcrClient ocrClient
    ) {
        this.invoiceRepository = invoiceRepository;
        this.supplierRepository = supplierRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.invoiceStatusRepository = invoiceStatusRepository;
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
        this.ocrExtractionRepository = ocrExtractionRepository;
        this.ocrExtractionFieldRepository = ocrExtractionFieldRepository;
        this.ocrClient = ocrClient;
    }

    @Override
    public List<Invoice> findAll() {
        return invoiceRepository.findAll();
    }

    @Override
    public Optional<Invoice> findById(Long id) {
        return invoiceRepository.findById(id);
    }

    @Override
    public Invoice save(Invoice invoice) {
        return invoiceRepository.save(invoice);
    }

    @Override
    @Transactional
    public InvoiceUploadResponse uploadAndAnalyze(MultipartFile file, Long supplierId) {
        Supplier supplier = findSupplierById(supplierId);
        Organization organization = findDefaultOrganization();
        User user = findDefaultUser();
        InvoiceStatus depositedStatus = findInvoiceStatusByCode("DEPOSEE");
        InvoiceStatus ocrInProgressStatus = findInvoiceStatusByCode("OCR_EN_COURS");
        InvoiceStatus extractedStatus = findInvoiceStatusByCode("EXTRAITE");

        OcrAnalysisResponse ocrAnalysis = analyzeInvoice(file);
        Invoice invoice = createInvoice(organization, supplier, user, depositedStatus, ocrAnalysis);
        invoice = invoiceRepository.save(invoice);
        saveStatusHistory(invoice, depositedStatus, user, "Invoice uploaded");

        InvoiceFile invoiceFile = saveInvoiceFile(invoice, file);

        updateInvoiceStatus(invoice, ocrInProgressStatus, user, "OCR analysis started");

        OcrExtraction ocrExtraction = saveOcrExtraction(invoice, ocrAnalysis);
        saveOcrExtractionFields(ocrExtraction, ocrAnalysis);

        updateInvoiceStatus(invoice, extractedStatus, user, "OCR analysis completed");

        return buildInvoiceUploadResponse(invoice, invoiceFile, ocrAnalysis);
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> findDetailsById(Long id) {
        return invoiceRepository.findById(id).map(invoice -> {
            InvoiceDetailsResponse response = new InvoiceDetailsResponse();
            response.setInvoiceId(invoice.getInvoiceId());
            response.setInvoiceNumber(invoice.getInvoiceNumber());
            response.setStatus(invoice.getInvoiceStatus().getCode());
            response.setSupplierName(invoice.getSupplier().getName());
            response.setCurrencyCode(invoice.getCurrencyCode());
            response.setTotalHt(invoice.getTotalHt().toString());
            response.setTotalTva(invoice.getTotalTva().toString());
            response.setTotalTtc(invoice.getTotalTtc().toString());

            invoiceFileRepository.findByInvoiceInvoiceId(id)
                    .ifPresent(invoiceFile -> response.setFilePath(invoiceFile.getFilePath()));

            ocrExtractionRepository.findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(id)
                    .ifPresent(ocrExtraction -> response.setOcrAnalysis(toOcrAnalysisResponse(ocrExtraction)));

            return response;
        });
    }

    private void saveStatusHistory(Invoice invoice, InvoiceStatus status, User user, String comment) {
        InvoiceStatusHistory history = new InvoiceStatusHistory();
        history.setInvoice(invoice);
        history.setInvoiceStatus(status);
        history.setChangedByUser(user);
        history.setChangedAt(LocalDateTime.now());
        history.setComment(comment);
        invoiceStatusHistoryRepository.save(history);
    }

    private Path storeFile(MultipartFile file, Long invoiceId) {
        String originalName = file.getOriginalFilename() == null ? "invoice-file" : file.getOriginalFilename();
        String storedFileName = invoiceId + "-" + UUID.randomUUID() + "-" + originalName;
        Path directory = Path.of(System.getProperty("java.io.tmpdir"), "facturation-files");
        Path target = directory.resolve(storedFileName);

        try {
            Files.createDirectories(directory);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return target;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to store uploaded file", exception);
        }
    }

    private Supplier findSupplierById(Long supplierId) {
        return supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found"));
    }

    private Organization findDefaultOrganization() {
        return organizationRepository.findById(1L)
                .orElseThrow(() -> new IllegalStateException("Default organization not found"));
    }

    private User findDefaultUser() {
        return userRepository.findById(1L)
                .orElseThrow(() -> new IllegalStateException("Default user not found"));
    }

    private InvoiceStatus findInvoiceStatusByCode(String code) {
        return invoiceStatusRepository.findByCode(code)
                .orElseThrow(() -> new IllegalStateException("Invoice status " + code + " not found"));
    }

    private OcrAnalysisResponse analyzeInvoice(MultipartFile file) {
        return ocrClient.analyze(file);
    }

    private Invoice createInvoice(
            Organization organization,
            Supplier supplier,
            User user,
            InvoiceStatus invoiceStatus,
            OcrAnalysisResponse ocrAnalysis
    ) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setSupplier(supplier);
        invoice.setCreatedByUser(user);
        invoice.setInvoiceStatus(invoiceStatus);
        invoice.setInvoiceNumber(extractInvoiceNumber(ocrAnalysis));
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setCurrencyCode("EUR");
        invoice.setTotalHt(extractAmount(ocrAnalysis, "totalHt"));
        invoice.setTotalTva(extractAmount(ocrAnalysis, "totalTva"));
        invoice.setTotalTtc(extractAmount(ocrAnalysis, "totalTtc"));
        invoice.setDescription("Invoice uploaded for OCR analysis");
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoice;
    }

    private String extractInvoiceNumber(OcrAnalysisResponse ocrAnalysis) {
        return extractNormalizedValue(ocrAnalysis, "invoiceNumber", "INV-" + System.currentTimeMillis());
    }

    private BigDecimal extractAmount(OcrAnalysisResponse ocrAnalysis, String fieldName) {
        return toBigDecimal(extractNormalizedValue(ocrAnalysis, fieldName, "0.00"));
    }

    private InvoiceFile saveInvoiceFile(Invoice invoice, MultipartFile file) {
        Path storedFilePath = storeFile(file, invoice.getInvoiceId());

        InvoiceFile invoiceFile = new InvoiceFile();
        invoiceFile.setInvoice(invoice);
        invoiceFile.setOriginalFileName(resolveOriginalFileName(file));
        invoiceFile.setStoredFileName(storedFilePath.getFileName().toString());
        invoiceFile.setFilePath(storedFilePath.toString());
        invoiceFile.setMimeType(resolveMimeType(file));
        invoiceFile.setFileSize(file.getSize());
        invoiceFile.setUploadedAt(LocalDateTime.now());
        return invoiceFileRepository.save(invoiceFile);
    }

    private String resolveOriginalFileName(MultipartFile file) {
        return file.getOriginalFilename() == null ? "invoice-file" : file.getOriginalFilename();
    }

    private String resolveMimeType(MultipartFile file) {
        return file.getContentType() == null ? "application/octet-stream" : file.getContentType();
    }

    private void updateInvoiceStatus(Invoice invoice, InvoiceStatus status, User user, String comment) {
        invoice.setInvoiceStatus(status);
        invoice.setUpdatedAt(LocalDateTime.now());
        invoiceRepository.save(invoice);
        saveStatusHistory(invoice, status, user, comment);
    }

    private OcrExtraction saveOcrExtraction(Invoice invoice, OcrAnalysisResponse ocrAnalysis) {
        OcrExtraction ocrExtraction = new OcrExtraction();
        ocrExtraction.setInvoice(invoice);
        ocrExtraction.setStatus(ocrAnalysis.getStatus());
        ocrExtraction.setEngineName(ocrClient.getEngineName());
        ocrExtraction.setEngineVersion(ocrClient.getEngineVersion());
        ocrExtraction.setRawText(ocrAnalysis.getRawText());
        ocrExtraction.setConfidenceScore(toBigDecimal(ocrAnalysis.getConfidenceScore()));
        ocrExtraction.setProcessedAt(LocalDateTime.now());
        ocrExtraction.setCreatedAt(LocalDateTime.now());
        return ocrExtractionRepository.save(ocrExtraction);
    }

    private void saveOcrExtractionFields(OcrExtraction ocrExtraction, OcrAnalysisResponse ocrAnalysis) {
        for (OcrFieldResponse field : ocrAnalysis.getFields()) {
            ocrExtractionFieldRepository.save(createOcrExtractionField(ocrExtraction, field));
        }
    }

    private OcrExtractionField createOcrExtractionField(OcrExtraction ocrExtraction, OcrFieldResponse field) {
        OcrExtractionField extractionField = new OcrExtractionField();
        extractionField.setOcrExtraction(ocrExtraction);
        extractionField.setFieldName(field.getFieldName());
        extractionField.setRawValue(field.getRawValue());
        extractionField.setNormalizedValue(field.getNormalizedValue());
        extractionField.setConfidenceScore(toBigDecimal(field.getConfidenceScore()));
        extractionField.setCorrected(false);
        extractionField.setCreatedAt(LocalDateTime.now());
        extractionField.setUpdatedAt(LocalDateTime.now());
        return extractionField;
    }

    private InvoiceUploadResponse buildInvoiceUploadResponse(
            Invoice invoice,
            InvoiceFile invoiceFile,
            OcrAnalysisResponse ocrAnalysis
    ) {
        InvoiceUploadResponse response = new InvoiceUploadResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setInvoiceNumber(invoice.getInvoiceNumber());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setFilePath(invoiceFile.getFilePath());
        response.setOcrAnalysis(ocrAnalysis);
        return response;
    }

    private String extractNormalizedValue(OcrAnalysisResponse response, String fieldName, String fallback) {
        return response.getFields().stream()
                .filter(field -> fieldName.equals(field.getFieldName()))
                .map(OcrFieldResponse::getNormalizedValue)
                .findFirst()
                .orElse(fallback);
    }

    private BigDecimal toBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return new BigDecimal(value);
    }

    private OcrAnalysisResponse toOcrAnalysisResponse(OcrExtraction ocrExtraction) {
        OcrAnalysisResponse response = new OcrAnalysisResponse();
        response.setStatus(ocrExtraction.getStatus());
        response.setRawText(ocrExtraction.getRawText());
        response.setConfidenceScore(ocrExtraction.getConfidenceScore() == null ? null : ocrExtraction.getConfidenceScore().toString());
        response.setFields(
                ocrExtractionFieldRepository.findByOcrExtractionOcrExtractionId(ocrExtraction.getOcrExtractionId())
                        .stream()
                        .map(this::toOcrFieldResponse)
                        .toList()
        );
        return response;
    }

    private OcrFieldResponse toOcrFieldResponse(OcrExtractionField field) {
        OcrFieldResponse response = new OcrFieldResponse();
        response.setFieldName(field.getFieldName());
        response.setRawValue(field.getRawValue());
        response.setNormalizedValue(field.getNormalizedValue());
        response.setConfidenceScore(field.getConfidenceScore() == null ? null : field.getConfidenceScore().toString());
        return response;
    }
}
