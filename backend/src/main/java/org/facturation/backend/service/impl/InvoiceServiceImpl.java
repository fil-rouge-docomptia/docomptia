package org.facturation.backend.service.impl;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
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
import org.facturation.backend.service.storage.InvoiceFileStorageService;
import org.facturation.backend.service.storage.StoredInvoiceFile;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;

@Service
public class InvoiceServiceImpl implements InvoiceService {

    private static final BigDecimal MAX_PERSISTED_AMOUNT = new BigDecimal("9999999999.99");
    private static final int AMOUNT_SCALE = 2;
    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy"),
            DateTimeFormatter.ISO_LOCAL_DATE
    );

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
    private final InvoiceFileStorageService invoiceFileStorageService;

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
            OcrClient ocrClient,
            InvoiceFileStorageService invoiceFileStorageService
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
        this.invoiceFileStorageService = invoiceFileStorageService;
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
        Organization organization = findDefaultOrganization();
        User user = findDefaultUser();
        InvoiceStatus depositedStatus = findInvoiceStatusByCode("DEPOSEE");
        InvoiceStatus ocrInProgressStatus = findInvoiceStatusByCode("OCR_EN_COURS");
        InvoiceStatus extractedStatus = findInvoiceStatusByCode("EXTRAITE");

        OcrAnalysisResponse ocrAnalysis = analyzeInvoice(file);
        Supplier supplier = resolveSupplier(supplierId, organization, ocrAnalysis);
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
        return invoiceRepository.findById(id).map(this::buildInvoiceDetailsResponse);
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> correctInvoice(Long id, InvoiceCorrectionRequest request) {
        return invoiceRepository.findById(id).map(invoice -> {
            applyInvoiceCorrections(invoice, request);
            invoice.setUpdatedAt(LocalDateTime.now());
            Invoice savedInvoice = invoiceRepository.save(invoice);
            return buildInvoiceDetailsResponse(savedInvoice);
        });
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> validateInvoice(Long id) {
        return updateInvoiceStatus(id, "VALIDEE", "Invoice validated");
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> rejectInvoice(Long id) {
        return updateInvoiceStatus(id, "REJETEE", "Invoice rejected");
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

    private Supplier findSupplierById(Long supplierId) {
        return supplierRepository.findById(supplierId)
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found"));
    }

    private void applyInvoiceCorrections(Invoice invoice, InvoiceCorrectionRequest request) {
        if (request.getInvoiceNumber() != null) {
            invoice.setInvoiceNumber(requireNotBlank(request.getInvoiceNumber(), "invoiceNumber"));
        }

        if (request.getCommandReference() != null) {
            invoice.setCommandReference(toNullableValue(request.getCommandReference()));
        }

        if (request.getInvoiceDate() != null) {
            invoice.setInvoiceDate(parseRequiredDate(request.getInvoiceDate(), "invoiceDate"));
        }

        if (request.getDueDate() != null) {
            invoice.setDueDate(parseOptionalDate(request.getDueDate(), "dueDate"));
        }

        if (request.getTotalHt() != null) {
            invoice.setTotalHt(parsePersistableAmount(request.getTotalHt(), "totalHt"));
        }

        if (request.getTotalTva() != null) {
            invoice.setTotalTva(parsePersistableAmount(request.getTotalTva(), "totalTva"));
        }

        if (request.getTotalTtc() != null) {
            invoice.setTotalTtc(parsePersistableAmount(request.getTotalTtc(), "totalTtc"));
        }

        if (request.getSupplierName() != null) {
            invoice.setSupplier(findSupplierByName(invoice, request.getSupplierName()));
        }
    }

    private Supplier findSupplierByName(Invoice invoice, String supplierName) {
        String normalizedSupplierName = requireNotBlank(supplierName, "supplierName");
        Long organizationId = invoice.getOrganization().getOrganizationId();
        return supplierRepository.findByOrganizationOrganizationIdAndNameIgnoreCase(organizationId, normalizedSupplierName)
                .or(() -> supplierRepository.findByOrganizationOrganizationIdAndLegalNameIgnoreCase(
                        organizationId,
                        normalizedSupplierName
                ))
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found"));
    }

    private Supplier resolveSupplier(Long supplierId, Organization organization, OcrAnalysisResponse ocrAnalysis) {
        if (supplierId != null) {
            return findSupplierById(supplierId);
        }

        String supplierName = extractNormalizedValue(ocrAnalysis, "supplierName", "Fournisseur a verifier");
        Supplier supplier = supplierRepository.findByOrganizationOrganizationIdAndNameIgnoreCase(
                        organization.getOrganizationId(),
                        supplierName
                )
                .or(() -> supplierRepository.findByOrganizationOrganizationIdAndLegalNameIgnoreCase(
                        organization.getOrganizationId(),
                        supplierName
                ))
                .orElseGet(() -> createSupplierToVerify(organization, supplierName));
        return updateSupplierFromOcrIfNeeded(supplier, ocrAnalysis);
    }

    private Supplier createSupplierToVerify(Organization organization, String supplierName) {
        Supplier supplier = new Supplier();
        supplier.setOrganization(organization);
        supplier.setName(supplierName);
        supplier.setLegalName(supplierName);
        supplier.setCreatedAt(LocalDateTime.now());
        supplier.setUpdatedAt(LocalDateTime.now());
        return supplierRepository.save(supplier);
    }

    private Supplier updateSupplierFromOcrIfNeeded(Supplier supplier, OcrAnalysisResponse ocrAnalysis) {
        boolean updated = false;

        Optional<String> siret = extractOptionalNormalizedValue(ocrAnalysis, "siret");
        if (isBlank(supplier.getSiret()) && siret.isPresent()) {
            supplier.setSiret(siret.get());
            updated = true;
        }

        Optional<String> vatNumber = extractOptionalNormalizedValue(ocrAnalysis, "vatNumber");
        if (isBlank(supplier.getVatNumber()) && vatNumber.isPresent()) {
            supplier.setVatNumber(vatNumber.get());
            updated = true;
        }

        if (!updated) {
            return supplier;
        }

        supplier.setUpdatedAt(LocalDateTime.now());
        return supplierRepository.save(supplier);
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
        invoice.setCommandReference(extractOptionalNormalizedValue(ocrAnalysis, "commandReference").orElse(null));
        invoice.setInvoiceDate(extractDate(ocrAnalysis, "invoiceDate").orElse(LocalDate.now()));
        invoice.setDueDate(extractDate(ocrAnalysis, "dueDate").orElse(null));
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
        return toPersistableAmount(extractNormalizedValue(ocrAnalysis, fieldName, "0.00"));
    }

    private InvoiceFile saveInvoiceFile(Invoice invoice, MultipartFile file) {
        StoredInvoiceFile storedFile = invoiceFileStorageService.store(file, invoice.getInvoiceId());

        InvoiceFile invoiceFile = new InvoiceFile();
        invoiceFile.setInvoice(invoice);
        invoiceFile.setOriginalFileName(storedFile.originalFileName());
        invoiceFile.setStoredFileName(storedFile.storedFileName());
        invoiceFile.setFilePath(storedFile.filePath());
        invoiceFile.setMimeType(storedFile.mimeType());
        invoiceFile.setFileSize(storedFile.fileSize());
        invoiceFile.setUploadedAt(LocalDateTime.now());
        return invoiceFileRepository.save(invoiceFile);
    }

    private void updateInvoiceStatus(Invoice invoice, InvoiceStatus status, User user, String comment) {
        invoice.setInvoiceStatus(status);
        invoice.setUpdatedAt(LocalDateTime.now());
        invoiceRepository.save(invoice);
        saveStatusHistory(invoice, status, user, comment);
    }

    private Optional<InvoiceDetailsResponse> updateInvoiceStatus(Long invoiceId, String statusCode, String comment) {
        return invoiceRepository.findById(invoiceId).map(invoice -> {
            User user = findDefaultUser();
            InvoiceStatus status = findInvoiceStatusByCode(statusCode);
            updateInvoiceStatus(invoice, status, user, comment);
            return buildInvoiceDetailsResponse(invoice);
        });
    }

    private OcrExtraction saveOcrExtraction(Invoice invoice, OcrAnalysisResponse ocrAnalysis) {
        OcrExtraction ocrExtraction = new OcrExtraction();
        ocrExtraction.setInvoice(invoice);
        ocrExtraction.setStatus(ocrAnalysis.getStatus());
        ocrExtraction.setEngineName("mock-ocr");
        ocrExtraction.setEngineVersion("1.0");
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
        return extractOptionalNormalizedValue(response, fieldName).orElse(fallback);
    }

    private Optional<String> extractOptionalNormalizedValue(OcrAnalysisResponse response, String fieldName) {
        return response.getFields().stream()
                .filter(field -> fieldName.equals(field.getFieldName()))
                .map(OcrFieldResponse::getNormalizedValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst();
    }

    private Optional<LocalDate> extractDate(OcrAnalysisResponse response, String fieldName) {
        return extractOptionalNormalizedValue(response, fieldName).flatMap(this::toLocalDate);
    }

    private Optional<LocalDate> toLocalDate(String value) {
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return Optional.of(LocalDate.parse(value, formatter));
            } catch (DateTimeParseException ignored) {
                // Try the next supported OCR date format.
            }
        }
        return Optional.empty();
    }

    private LocalDate parseRequiredDate(String value, String fieldName) {
        return toLocalDate(requireNotBlank(value, fieldName))
                .orElseThrow(() -> new IllegalArgumentException("Invalid " + fieldName));
    }

    private LocalDate parseOptionalDate(String value, String fieldName) {
        String normalizedValue = toNullableValue(value);
        if (normalizedValue == null) {
            return null;
        }
        return toLocalDate(normalizedValue)
                .orElseThrow(() -> new IllegalArgumentException("Invalid " + fieldName));
    }

    private String requireNotBlank(String value, String fieldName) {
        if (isBlank(value)) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.trim();
    }

    private String toNullableValue(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private BigDecimal toBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException exception) {
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal toPersistableAmount(String value) {
        BigDecimal amount = toBigDecimal(value).setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
        if (amount.abs().compareTo(MAX_PERSISTED_AMOUNT) > 0) {
            return BigDecimal.ZERO.setScale(AMOUNT_SCALE);
        }
        return amount;
    }

    private BigDecimal parsePersistableAmount(String value, String fieldName) {
        String normalizedValue = requireNotBlank(value, fieldName);
        try {
            BigDecimal amount = new BigDecimal(normalizedValue).setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
            if (amount.abs().compareTo(MAX_PERSISTED_AMOUNT) > 0) {
                throw new IllegalArgumentException(fieldName + " is too large");
            }
            return amount;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Invalid " + fieldName, exception);
        }
    }

    private InvoiceDetailsResponse buildInvoiceDetailsResponse(Invoice invoice) {
        InvoiceDetailsResponse response = new InvoiceDetailsResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setInvoiceNumber(invoice.getInvoiceNumber());
        response.setCommandReference(invoice.getCommandReference());
        response.setInvoiceDate(invoice.getInvoiceDate() == null ? null : invoice.getInvoiceDate().toString());
        response.setDueDate(invoice.getDueDate() == null ? null : invoice.getDueDate().toString());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setSupplierName(invoice.getSupplier().getName());
        response.setCurrencyCode(invoice.getCurrencyCode());
        response.setTotalHt(invoice.getTotalHt().toString());
        response.setTotalTva(invoice.getTotalTva().toString());
        response.setTotalTtc(invoice.getTotalTtc().toString());

        invoiceFileRepository.findByInvoiceInvoiceId(invoice.getInvoiceId())
                .ifPresent(invoiceFile -> response.setFilePath(invoiceFile.getFilePath()));

        ocrExtractionRepository.findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(invoice.getInvoiceId())
                .ifPresent(ocrExtraction -> response.setOcrAnalysis(toOcrAnalysisResponse(ocrExtraction)));

        return response;
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
