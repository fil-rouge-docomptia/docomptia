package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.ProcessingAnomalyResponse;
import org.facturation.backend.exception.InvoiceOcrFailureException;
import org.facturation.backend.exception.InvoicePostOcrFailureException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.OcrErrorStep;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.ProcessingAnomalyCode;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.InvoiceAmountConsistencyService;
import org.facturation.backend.service.InvoiceDuplicateAlertService;
import org.facturation.backend.service.InvoiceFileIntegrityService;
import org.facturation.backend.service.InvoiceFileValidator;
import org.facturation.backend.service.InvoiceIngestionRequest;
import org.facturation.backend.service.InvoiceIngestionResult;
import org.facturation.backend.service.InvoiceIngestionService;
import org.facturation.backend.service.InvoiceOcrService;
import org.facturation.backend.service.InvoicePostOcrFailureService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.NotificationService;
import org.facturation.backend.service.OcrErrorService;
import org.facturation.backend.service.OcrSupplierResolution;
import org.facturation.backend.service.ProcessingAnomalyService;
import org.facturation.backend.service.SubscriptionQuotaService;
import org.facturation.backend.service.SupplierService;
import org.facturation.backend.service.storage.InvoiceFileStorageService;
import org.facturation.backend.service.storage.StoredInvoiceFile;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;

@Service
public class InvoiceIngestionServiceImpl implements InvoiceIngestionService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceFileStorageService invoiceFileStorageService;
    private final InvoiceFileIntegrityService invoiceFileIntegrityService;
    private final InvoiceFileValidator invoiceFileValidator;
    private final InvoiceOcrService invoiceOcrService;
    private final InvoicePostOcrFailureService invoicePostOcrFailureService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final InvoiceDuplicateAlertService duplicateAlertService;
    private final InvoiceAmountConsistencyService invoiceAmountConsistencyService;
    private final NotificationService notificationService;
    private final OcrErrorService ocrErrorService;
    private final ProcessingAnomalyService processingAnomalyService;
    private final SubscriptionQuotaService subscriptionQuotaService;
    private final SupplierService supplierService;

    public InvoiceIngestionServiceImpl(
            InvoiceRepository invoiceRepository,
            InvoiceFileRepository invoiceFileRepository,
            InvoiceFileStorageService invoiceFileStorageService,
            InvoiceFileIntegrityService invoiceFileIntegrityService,
            InvoiceFileValidator invoiceFileValidator,
            InvoiceOcrService invoiceOcrService,
            InvoicePostOcrFailureService invoicePostOcrFailureService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            InvoiceDuplicateAlertService duplicateAlertService,
            InvoiceAmountConsistencyService invoiceAmountConsistencyService,
            NotificationService notificationService,
            OcrErrorService ocrErrorService,
            ProcessingAnomalyService processingAnomalyService,
            SubscriptionQuotaService subscriptionQuotaService,
            SupplierService supplierService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceFileStorageService = invoiceFileStorageService;
        this.invoiceFileIntegrityService = invoiceFileIntegrityService;
        this.invoiceFileValidator = invoiceFileValidator;
        this.invoiceOcrService = invoiceOcrService;
        this.invoicePostOcrFailureService = invoicePostOcrFailureService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.duplicateAlertService = duplicateAlertService;
        this.invoiceAmountConsistencyService = invoiceAmountConsistencyService;
        this.notificationService = notificationService;
        this.ocrErrorService = ocrErrorService;
        this.processingAnomalyService = processingAnomalyService;
        this.subscriptionQuotaService = subscriptionQuotaService;
        this.supplierService = supplierService;
    }

    @Override
    public InvoiceIngestionResult ingest(InvoiceIngestionRequest request) {
        invoiceFileValidator.validate(request.file());
        validateAuditContext(request);

        Organization organization = request.organization();
        User auditUser = request.auditUser();
        Supplier selectedSupplier = request.supplierId() == null
                ? null
                : supplierService.findRequiredByIdForOrganization(request.supplierId(), organization);
        subscriptionQuotaService.ensureInvoiceCanBeCreated(organization.getOrganizationId());

        Invoice invoice = createDraftInvoice(organization, request, auditUser);
        invoiceStatusWorkflowService.recordUpload(invoice, auditUser);
        storeFile(invoice, request.file(), auditUser);
        invoiceStatusWorkflowService.startOcrAnalysis(invoice, auditUser);

        OcrAnalysisResponse ocrAnalysis = analyzeInvoice(invoice, auditUser, request.file());
        PostOcrProcessingResult processingResult = processValidOcrResponse(
                invoice, selectedSupplier, organization, auditUser, ocrAnalysis
        );
        duplicateAlertService.detectDuplicates(processingResult.invoice());
        return new InvoiceIngestionResult(
                processingResult.invoice(),
                ocrAnalysis,
                processingResult.warnings()
        );
    }

    private void validateAuditContext(InvoiceIngestionRequest request) {
        Objects.requireNonNull(request.organization(), "organization is required");
        Objects.requireNonNull(request.origin(), "origin is required");
        Objects.requireNonNull(request.auditUser(), "auditUser is required");
        if (!Objects.equals(
                request.organization().getOrganizationId(),
                request.auditUser().getOrganization().getOrganizationId()
        )) {
            throw new IllegalArgumentException("auditUser must belong to the invoice organization");
        }
    }

    private Invoice createDraftInvoice(
            Organization organization,
            InvoiceIngestionRequest request,
            User auditUser
    ) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setCreatedByUser(auditUser);
        invoice.setInvoiceStatus(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.DEPOSEE));
        invoice.setOrigin(request.origin());
        invoice.setCurrencyCode(organization.getDefaultCurrencyCode());
        invoice.setDescription("Invoice uploaded for OCR analysis");
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private void storeFile(Invoice invoice, MultipartFile file, User auditUser) {
        try {
            StoredInvoiceFile storedFile = invoiceFileStorageService.store(file, invoice.getInvoiceId());

            InvoiceFile invoiceFile = new InvoiceFile();
            invoiceFile.setInvoice(invoice);
            invoiceFile.setOriginalFileName(storedFile.originalFileName());
            invoiceFile.setStoredFileName(storedFile.storedFileName());
            invoiceFile.setFilePath(storedFile.filePath());
            invoiceFile.setMimeType(storedFile.mimeType());
            invoiceFile.setFileSize(storedFile.fileSize());
            invoiceFile.setUploadedAt(LocalDateTime.now());
            invoiceFile.setSha256Checksum(invoiceFileIntegrityService.calculateSha256(file));
            invoiceFileRepository.save(invoiceFile);
        } catch (RuntimeException exception) {
            OcrError error = invoicePostOcrFailureService.recordFailure(
                    invoice.getInvoiceId(), auditUser, exception, OcrErrorStep.FILE_STORAGE
            );
            throw new InvoicePostOcrFailureException(invoice.getInvoiceId(), error, exception);
        }
    }

    private OcrAnalysisResponse analyzeInvoice(Invoice invoice, User auditUser, MultipartFile file) {
        try {
            return invoiceOcrService.analyze(file);
        } catch (RuntimeException exception) {
            invoiceStatusWorkflowService.markOcrFailure(invoice, auditUser);
            OcrError ocrError = ocrErrorService.recordFailure(invoice, exception);
            notificationService.notifyOcrFailure(invoice, ocrError);
            throw new InvoiceOcrFailureException(invoice.getInvoiceId(), ocrError, exception);
        }
    }

    private PostOcrProcessingResult processValidOcrResponse(
            Invoice invoice,
            Supplier selectedSupplier,
            Organization organization,
            User auditUser,
            OcrAnalysisResponse ocrAnalysis
    ) {
        OcrErrorStep step = OcrErrorStep.SUPPLIER_RESOLUTION;
        try {
            OcrSupplierResolution supplierResolution = supplierService.resolveForInvoiceUploadWithWarnings(
                    selectedSupplier, organization, ocrAnalysis
            );

            step = OcrErrorStep.EXTRACTION_PERSISTENCE;
            applyOcrAnalysis(invoice, supplierResolution.supplier(), ocrAnalysis);
            Invoice savedInvoice = invoiceRepository.save(invoice);
            invoiceOcrService.saveExtraction(savedInvoice, ocrAnalysis);
            EnumSet<ProcessingAnomalyCode> anomalyCodes = EnumSet.noneOf(ProcessingAnomalyCode.class);
            anomalyCodes.addAll(supplierResolution.anomalies());
            if (hasMissingRequiredFields(savedInvoice)) {
                anomalyCodes.add(ProcessingAnomalyCode.OCR_INCOMPLETE);
            }
            if (hasInconsistentAmounts(savedInvoice)) {
                anomalyCodes.add(ProcessingAnomalyCode.INCONSISTENT_AMOUNTS);
            }
            List<ProcessingAnomalyResponse> warnings = anomalyCodes.stream()
                    .map(code -> processingAnomalyService.create(savedInvoice.getInvoiceId(), code))
                    .toList();

            step = OcrErrorStep.STATUS_UPDATE;
            invoiceStatusWorkflowService.completeOcrAnalysis(savedInvoice, auditUser);
            return new PostOcrProcessingResult(savedInvoice, warnings);
        } catch (RuntimeException exception) {
            OcrError error = invoicePostOcrFailureService.recordFailure(
                    invoice.getInvoiceId(), auditUser, exception, step
            );
            throw new InvoicePostOcrFailureException(invoice.getInvoiceId(), error, exception);
        }
    }

    private void applyOcrAnalysis(Invoice invoice, Supplier supplier, OcrAnalysisResponse ocrAnalysis) {
        invoice.setSupplier(supplier);
        if (supplier != null) {
            invoice.setSupplierLegalNameSnapshot(supplier.getLegalName());
            invoice.setSupplierAddressSnapshot(supplier.getAddress());
            invoice.setSupplierIdentifiersSnapshot(java.util.stream.Stream.of(supplier.getSiret(), supplier.getVatNumber())
                    .filter(Objects::nonNull).collect(java.util.stream.Collectors.joining(", ")));
            invoice.setSupplierMatchConfirmed(true);
        }
        invoice.setInvoiceNumber(invoiceOcrService.extractOptionalNormalizedValue(ocrAnalysis, "invoiceNumber").orElse(null));
        invoice.setCommandReference(invoiceOcrService.extractOptionalNormalizedValue(ocrAnalysis, "commandReference").orElse(null));
        invoice.setInvoiceDate(invoiceOcrService.extractDate(ocrAnalysis, "invoiceDate").orElse(null));
        invoice.setDueDate(invoiceOcrService.extractDate(ocrAnalysis, "dueDate").orElse(null));
        invoice.setTotalHt(invoiceOcrService.extractOptionalAmount(ocrAnalysis, "totalHt").orElse(null));
        invoice.setTotalTva(invoiceOcrService.extractOptionalAmount(ocrAnalysis, "totalTva").orElse(null));
        invoice.setTotalTtc(invoiceOcrService.extractOptionalAmount(ocrAnalysis, "totalTtc").orElse(null));
        invoiceAmountConsistencyService.recalculateTtcWhenMissingOrWithinTolerance(invoice);
        invoice.setUpdatedAt(LocalDateTime.now());
    }

    private boolean hasMissingRequiredFields(Invoice invoice) {
        return invoice.getSupplier() == null
                || isBlank(invoice.getInvoiceNumber())
                || invoice.getInvoiceDate() == null
                || invoice.getTotalHt() == null
                || invoice.getTotalTva() == null
                || invoice.getTotalTtc() == null;
    }

    private boolean hasInconsistentAmounts(Invoice invoice) {
        return invoice.getTotalHt() != null
                && invoice.getTotalTva() != null
                && invoice.getTotalTtc() != null
                && !invoiceAmountConsistencyService.isConsistent(invoice);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record PostOcrProcessingResult(Invoice invoice, List<ProcessingAnomalyResponse> warnings) {
    }
}
