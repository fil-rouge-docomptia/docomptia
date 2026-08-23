package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.DuplicateAlertDecisionRequest;
import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceStatusResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.exception.InvoiceOcrFailureException;
import org.facturation.backend.exception.UnbalancedAccountingEntryException;
import org.facturation.backend.mapper.InvoiceResponseMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.DuplicateAlertDecision;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.AccountingEntryService;
import org.facturation.backend.service.AuditLogService;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.InvoiceDuplicateAlertService;
import org.facturation.backend.service.InvoiceFileValidator;
import org.facturation.backend.service.InvoiceOcrService;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.OcrErrorService;
import org.facturation.backend.service.SupplierService;
import org.facturation.backend.service.storage.InvoiceFileStorageService;
import org.facturation.backend.service.storage.StoredInvoiceFile;
import jakarta.persistence.criteria.Predicate;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
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
    private final AccountingEntryService accountingEntryService;
    private final AuditLogService auditLogService;
    private final InvoiceFileValidator invoiceFileValidator;
    private final InvoiceResponseMapper invoiceResponseMapper;
    private final InvoiceOcrService invoiceOcrService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final OcrErrorService ocrErrorService;
    private final SupplierService supplierService;
    private final CurrentUserService currentUserService;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceFileStorageService invoiceFileStorageService;
    private final InvoiceDuplicateAlertService duplicateAlertService;

    public InvoiceServiceImpl(
            InvoiceRepository invoiceRepository,
            AccountingEntryService accountingEntryService,
            AuditLogService auditLogService,
            InvoiceFileValidator invoiceFileValidator,
            InvoiceResponseMapper invoiceResponseMapper,
            InvoiceOcrService invoiceOcrService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            OcrErrorService ocrErrorService,
            SupplierService supplierService,
            CurrentUserService currentUserService,
            InvoiceFileRepository invoiceFileRepository,
            InvoiceFileStorageService invoiceFileStorageService,
            InvoiceDuplicateAlertService duplicateAlertService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.accountingEntryService = accountingEntryService;
        this.auditLogService = auditLogService;
        this.invoiceFileValidator = invoiceFileValidator;
        this.invoiceResponseMapper = invoiceResponseMapper;
        this.invoiceOcrService = invoiceOcrService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.ocrErrorService = ocrErrorService;
        this.supplierService = supplierService;
        this.currentUserService = currentUserService;
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceFileStorageService = invoiceFileStorageService;
        this.duplicateAlertService = duplicateAlertService;
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
    public InvoiceUploadResponse uploadAndAnalyze(MultipartFile file, Long supplierId) {
        invoiceFileValidator.validate(file);

        User user = currentUserService.getCurrentUser();
        Organization organization = user.getOrganization();
        Supplier selectedSupplier = supplierId == null
                ? null
                : supplierService.findRequiredByIdForOrganization(supplierId, organization);
        InvoiceStatus depositedStatus = invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.DEPOSEE);

        Invoice invoice = createDraftInvoice(organization, user, depositedStatus);
        invoiceStatusWorkflowService.recordUpload(invoice, user);
        saveInvoiceFile(invoice, file);
        invoiceStatusWorkflowService.startOcrAnalysis(invoice, user);

        OcrAnalysisResponse ocrAnalysis = analyzeInvoice(invoice, user, file);
        Supplier supplier = selectedSupplier == null
                ? supplierService.resolveForInvoiceUpload(null, organization, ocrAnalysis)
                : selectedSupplier;
        invoice = completeOcrAnalysis(invoice, supplier, user, ocrAnalysis);

        return invoiceResponseMapper.toUploadResponse(invoice, ocrAnalysis);
    }

    @Override
    public Optional<InvoiceDetailsResponse> retryOcr(Long invoiceId) {
        User user = currentUserService.getCurrentUser();
        Long organizationId = user.getOrganization().getOrganizationId();
        return invoiceRepository.findForOcrRetryByInvoiceIdAndOrganizationOrganizationId(invoiceId, organizationId)
                .map(invoice -> {
            invoiceStatusWorkflowService.ensureCanRetryOcr(invoice);
            InvoiceFile invoiceFile = invoiceFileRepository.findByInvoiceInvoiceId(invoiceId)
                    .orElseThrow(() -> new IllegalStateException("Stored invoice file not found"));
            MultipartFile file = invoiceFileStorageService.load(invoiceFile);
            invoiceStatusWorkflowService.restartOcrAnalysis(invoice, user);

            OcrAnalysisResponse ocrAnalysis = analyzeInvoice(invoice, user, file);
            Supplier supplier = invoice.getSupplier() == null
                    ? supplierService.resolveForInvoiceUpload(null, invoice.getOrganization(), ocrAnalysis)
                    : invoice.getSupplier();
            completeOcrAnalysis(invoice, supplier, user, ocrAnalysis);
            Invoice responseInvoice = invoiceRepository
                    .findForOcrRetryByInvoiceIdAndOrganizationOrganizationId(invoiceId, organizationId)
                    .orElseThrow();
            return invoiceResponseMapper.toDetailsResponse(responseInvoice);
        });
    }

    private OcrAnalysisResponse analyzeInvoice(Invoice invoice, User user, MultipartFile file) {
        try {
            return invoiceOcrService.analyze(file);
        } catch (RuntimeException exception) {
            invoiceStatusWorkflowService.markOcrFailure(invoice, user);
            OcrError ocrError = ocrErrorService.recordFailure(invoice, exception);
            throw new InvoiceOcrFailureException(invoice.getInvoiceId(), ocrError, exception);
        }
    }

    private Invoice completeOcrAnalysis(
            Invoice invoice,
            Supplier supplier,
            User user,
            OcrAnalysisResponse ocrAnalysis
    ) {
        applyOcrAnalysis(invoice, supplier, ocrAnalysis);
        Invoice savedInvoice = invoiceRepository.save(invoice);
        invoiceOcrService.saveExtraction(savedInvoice, ocrAnalysis);

        invoiceStatusWorkflowService.completeOcrAnalysis(savedInvoice, user);
        duplicateAlertService.detectDuplicates(savedInvoice);
        return savedInvoice;
    }

    @Override
    @Transactional
    public List<InvoiceListItemResponse> searchInvoices(String status, String supplier, String invoiceDate) {
        Long organizationId = currentUserService.getCurrentUser().getOrganization().getOrganizationId();
        String statusFilter = toNullableValue(status);
        String supplierFilter = toNullableValue(supplier);
        LocalDate invoiceDateFilter = parseOptionalDateFilter(invoiceDate);

        return invoiceRepository.findAll(byOrganization(organizationId).and(buildInvoiceSearchSpecification(
                        organizationId,
                        statusFilter,
                        supplierFilter,
                        invoiceDateFilter
                )))
                .stream()
                .map(invoiceResponseMapper::toListItemResponse)
                .toList();
    }

    private Specification<Invoice> byOrganization(Long organizationId) {
        return (root, query, criteriaBuilder) -> criteriaBuilder.equal(
                root.get("organization").get("organizationId"),
                organizationId
        );
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> findDetailsById(Long id) {
        User user = currentUserService.getCurrentUser();
        return invoiceRepository.findByInvoiceIdAndOrganizationOrganizationId(
                id,
                user.getOrganization().getOrganizationId()
        ).map(invoiceResponseMapper::toDetailsResponse);
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> correctInvoice(Long id, InvoiceCorrectionRequest request) {
        User user = currentUserService.getCurrentUser();
        return invoiceRepository.findByInvoiceIdAndOrganizationOrganizationId(
                id,
                user.getOrganization().getOrganizationId()
        ).map(invoice -> {
            boolean hasCorrections = hasRequestedCorrections(request);
            if (!hasCorrections) {
                throw new IllegalArgumentException("At least one correction field is required");
            }

            invoiceStatusWorkflowService.ensureCanCorrect(invoice, true);
            List<AppliedCorrection> appliedCorrections = applyInvoiceCorrections(invoice, request);
            if (appliedCorrections.isEmpty()) {
                throw new IllegalArgumentException("At least one changed field is required");
            }
            invoice.setUpdatedAt(LocalDateTime.now());
            Invoice savedInvoice = invoiceRepository.save(invoice);
            persistAppliedCorrections(savedInvoice, user, appliedCorrections);
            invoiceStatusWorkflowService.reintegrateAfterCorrectionIfNeeded(savedInvoice, user, true);
            return invoiceResponseMapper.toDetailsResponse(savedInvoice);
        });
    }

    @Override
    @Transactional
    public Optional<InvoiceStatusResponse> submitForValidation(Long id) {
        User user = currentUserService.getCurrentUser();
        return findInvoiceForCurrentOrganization(id, user).map(invoice -> {
            invoiceStatusWorkflowService.submitForValidation(invoice, user);
            return invoiceResponseMapper.toStatusResponse(invoice);
        });
    }

    @Override
    @Transactional
    public Optional<InvoiceStatusResponse> validateInvoice(Long id) {
        User user = currentUserService.getCurrentUser();
        return findInvoiceForCurrentOrganization(id, user).map(invoice -> {
            duplicateAlertService.ensureNoPendingAlerts(id, "be validated");
            invoiceStatusWorkflowService.validateInvoice(invoice, user);
            return invoiceResponseMapper.toStatusResponse(invoice);
        });
    }

    @Override
    @Transactional
    public Optional<InvoiceStatusResponse> requestInvoiceCorrection(Long id, String reason) {
        User user = currentUserService.getCurrentUser();
        return findInvoiceForCurrentOrganization(id, user).map(invoice -> {
            duplicateAlertService.ensureNoPendingAlerts(id, "receive a correction request");
            invoiceStatusWorkflowService.requestInvoiceCorrection(invoice, user, reason);
            return invoiceResponseMapper.toStatusResponse(invoice);
        });
    }

    @Override
    @Transactional
    public Optional<InvoiceStatusResponse> rejectInvoice(Long id, String reason) {
        User user = currentUserService.getCurrentUser();
        return findInvoiceForCurrentOrganization(id, user).map(invoice -> {
            duplicateAlertService.ensureNoPendingAlerts(id, "be rejected outside the duplicate decision workflow");
            invoiceStatusWorkflowService.rejectInvoice(invoice, user, reason);
            return invoiceResponseMapper.toStatusResponse(invoice);
        });
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> decideDuplicateAlert(
            Long invoiceId,
            Long alertId,
            DuplicateAlertDecisionRequest request
    ) {
        User user = currentUserService.getCurrentUser();
        if (!invoiceRepository.existsByInvoiceIdAndOrganizationOrganizationId(
                invoiceId,
                user.getOrganization().getOrganizationId()
        )) {
            return Optional.empty();
        }
        DuplicateAlertDecision decision = parseDuplicateAlertDecision(request);
        Invoice invoice = duplicateAlertService.decide(
                invoiceId,
                alertId,
                decision,
                request.getReason(),
                user
        );
        return Optional.of(invoiceResponseMapper.toDetailsResponse(invoice));
    }

    private DuplicateAlertDecision parseDuplicateAlertDecision(DuplicateAlertDecisionRequest request) {
        if (request == null || request.getDecision() == null || request.getDecision().isBlank()) {
            throw new IllegalArgumentException("Duplicate alert decision is required");
        }
        try {
            return DuplicateAlertDecision.valueOf(request.getDecision().trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Decision must be IGNORE, CONFIRM or REJECT");
        }
    }

    @Override
    @Transactional(dontRollbackOn = UnbalancedAccountingEntryException.class)
    public Optional<InvoiceAccountingEntryResponse> generateAccountingEntry(Long id) {
        User user = currentUserService.getCurrentUser();
        Long organizationId = user.getOrganization().getOrganizationId();
        return invoiceRepository.findForAccountingGenerationByInvoiceIdAndOrganizationOrganizationId(id, organizationId)
                .map(invoice -> {
            Optional<AccountingEntry> existingAccountingEntry = accountingEntryService.findByInvoiceId(id);
            AccountingEntry accountingEntry;
            if (existingAccountingEntry.isPresent()) {
                accountingEntry = existingAccountingEntry.get();
            } else {
                duplicateAlertService.ensureNoPendingAlerts(id, "generate an accounting entry");
                invoiceStatusWorkflowService.ensureCanGenerateAccountingEntry(invoice);
                accountingEntry = accountingEntryService.generateFromInvoice(invoice, user);
            }

            InvoiceAccountingEntryResponse response =
                    invoiceResponseMapper.toAccountingEntryResponse(invoice, accountingEntry);
            AccountingEntryResponse accountingEntryResponse = response.getAccountingEntry();
            if (!accountingEntryResponse.isBalanced()) {
                if (InvoiceStatusCode.EXPORTABLE.getCode().equals(invoice.getInvoiceStatus().getCode())) {
                    invoiceStatusWorkflowService.markAccountingEntryToCorrect(invoice, user);
                }
                throw new UnbalancedAccountingEntryException(accountingEntryResponse);
            }
            if (InvoiceStatusCode.VALIDEE.getCode().equals(invoice.getInvoiceStatus().getCode())) {
                invoiceStatusWorkflowService.markExportable(invoice, user);
            }
            return invoiceResponseMapper.toAccountingEntryResponse(invoice, accountingEntry);
        });
    }

    private Optional<Invoice> findInvoiceForCurrentOrganization(Long invoiceId, User user) {
        return invoiceRepository.findByInvoiceIdAndOrganizationOrganizationId(
                invoiceId,
                user.getOrganization().getOrganizationId()
        );
    }

    private List<AppliedCorrection> applyInvoiceCorrections(Invoice invoice, InvoiceCorrectionRequest request) {
        List<AppliedCorrection> appliedCorrections = new ArrayList<>();

        if (request.getInvoiceNumber() != null) {
            String invoiceNumber = requireNotBlank(request.getInvoiceNumber(), "invoiceNumber");
            registerCorrection(appliedCorrections, "invoiceNumber", invoice.getInvoiceNumber(), invoiceNumber);
            invoice.setInvoiceNumber(invoiceNumber);
        }

        if (request.getCommandReference() != null) {
            String commandReference = toNullableValue(request.getCommandReference());
            registerCorrection(
                    appliedCorrections,
                    "commandReference",
                    invoice.getCommandReference(),
                    commandReference
            );
            invoice.setCommandReference(commandReference);
        }

        if (request.getInvoiceDate() != null) {
            LocalDate invoiceDate = parseRequiredDate(request.getInvoiceDate(), "invoiceDate");
            registerCorrection(
                    appliedCorrections,
                    "invoiceDate",
                    toStringOrNull(invoice.getInvoiceDate()),
                    invoiceDate.toString()
            );
            invoice.setInvoiceDate(invoiceDate);
        }

        if (request.getDueDate() != null) {
            LocalDate dueDate = parseOptionalDate(request.getDueDate(), "dueDate");
            registerCorrection(
                    appliedCorrections,
                    "dueDate",
                    toStringOrNull(invoice.getDueDate()),
                    toStringOrNull(dueDate)
            );
            invoice.setDueDate(dueDate);
        }

        if (request.getTotalHt() != null) {
            BigDecimal totalHt = parsePersistableAmount(request.getTotalHt(), "totalHt");
            registerCorrection(
                    appliedCorrections,
                    "totalHt",
                    toStringOrNull(invoice.getTotalHt()),
                    totalHt.toString()
            );
            invoice.setTotalHt(totalHt);
        }

        if (request.getTotalTva() != null) {
            BigDecimal totalTva = parsePersistableAmount(request.getTotalTva(), "totalTva");
            registerCorrection(
                    appliedCorrections,
                    "totalTva",
                    toStringOrNull(invoice.getTotalTva()),
                    totalTva.toString()
            );
            invoice.setTotalTva(totalTva);
        }

        if (request.getTotalTtc() != null) {
            BigDecimal totalTtc = parsePersistableAmount(request.getTotalTtc(), "totalTtc");
            registerCorrection(
                    appliedCorrections,
                    "totalTtc",
                    toStringOrNull(invoice.getTotalTtc()),
                    totalTtc.toString()
            );
            invoice.setTotalTtc(totalTtc);
        }

        if (request.getSupplierName() != null) {
            Supplier supplier = supplierService.findRequiredByName(invoice, request.getSupplierName());
            registerCorrection(
                    appliedCorrections,
                    "supplierName",
                    extractSupplierName(invoice.getSupplier()),
                    extractSupplierName(supplier)
            );
            invoice.setSupplier(supplier);
        }

        return appliedCorrections;
    }

    private void persistAppliedCorrections(Invoice invoice, User user, List<AppliedCorrection> appliedCorrections) {
        for (AppliedCorrection appliedCorrection : appliedCorrections) {
            invoiceOcrService.saveManualCorrection(invoice, appliedCorrection.fieldName(), appliedCorrection.newValue(), user);
            auditLogService.save(createAuditLog(invoice, user, appliedCorrection));
        }
    }

    private AuditLog createAuditLog(Invoice invoice, User user, AppliedCorrection appliedCorrection) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(invoice.getOrganization());
        auditLog.setUser(user);
        auditLog.setEntityName(Invoice.class.getSimpleName());
        auditLog.setEntityId(invoice.getInvoiceId());
        auditLog.setAction("FIELD_CORRECTION");
        auditLog.setOldValue(formatAuditValue(appliedCorrection.fieldName(), appliedCorrection.oldValue()));
        auditLog.setNewValue(formatAuditValue(appliedCorrection.fieldName(), appliedCorrection.newValue()));
        auditLog.setCreatedAt(LocalDateTime.now());
        return auditLog;
    }

    private String formatAuditValue(String fieldName, String value) {
        return fieldName + "=" + (value == null ? "null" : value);
    }

    private void registerCorrection(
            List<AppliedCorrection> appliedCorrections,
            String fieldName,
            String oldValue,
            String newValue
    ) {
        if (Objects.equals(oldValue, newValue)) {
            return;
        }
        appliedCorrections.add(new AppliedCorrection(fieldName, oldValue, newValue));
    }

    private String extractSupplierName(Supplier supplier) {
        return supplier == null ? null : supplier.getName();
    }

    private Invoice createDraftInvoice(
            Organization organization,
            User user,
            InvoiceStatus invoiceStatus
    ) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setCreatedByUser(user);
        invoice.setInvoiceStatus(invoiceStatus);
        invoice.setCurrencyCode("EUR");
        invoice.setDescription("Invoice uploaded for OCR analysis");
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private void applyOcrAnalysis(
            Invoice invoice,
            Supplier supplier,
            OcrAnalysisResponse ocrAnalysis
    ) {
        invoice.setSupplier(supplier);
        invoice.setInvoiceNumber(invoiceOcrService.extractOptionalNormalizedValue(ocrAnalysis, "invoiceNumber").orElse(null));
        invoice.setCommandReference(invoiceOcrService.extractOptionalNormalizedValue(ocrAnalysis, "commandReference").orElse(null));
        invoice.setInvoiceDate(invoiceOcrService.extractDate(ocrAnalysis, "invoiceDate").orElse(null));
        invoice.setDueDate(invoiceOcrService.extractDate(ocrAnalysis, "dueDate").orElse(null));
        invoice.setTotalHt(invoiceOcrService.extractOptionalAmount(ocrAnalysis, "totalHt").orElse(null));
        invoice.setTotalTva(invoiceOcrService.extractOptionalAmount(ocrAnalysis, "totalTva").orElse(null));
        invoice.setTotalTtc(invoiceOcrService.extractOptionalAmount(ocrAnalysis, "totalTtc").orElse(null));
        invoice.setUpdatedAt(LocalDateTime.now());
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

    private boolean hasRequestedCorrections(InvoiceCorrectionRequest request) {
        return request.getInvoiceNumber() != null
                || request.getCommandReference() != null
                || request.getInvoiceDate() != null
                || request.getDueDate() != null
                || request.getTotalHt() != null
                || request.getTotalTva() != null
                || request.getTotalTtc() != null
                || request.getSupplierName() != null;
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

    private LocalDate parseOptionalDateFilter(String value) {
        String normalizedValue = toNullableValue(value);
        if (normalizedValue == null) {
            return null;
        }
        return toLocalDate(normalizedValue)
                .orElseThrow(() -> new IllegalArgumentException("Invalid date"));
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

    private String toStringOrNull(LocalDate value) {
        return value == null ? null : value.toString();
    }

    private String toStringOrNull(BigDecimal value) {
        return value == null ? null : value.toString();
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

    private Specification<Invoice> buildInvoiceSearchSpecification(
            Long organizationId,
            String status,
            String supplier,
            LocalDate invoiceDate
    ) {
        return (root, query, criteriaBuilder) -> {
            query.orderBy(criteriaBuilder.desc(root.get("createdAt")));
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(
                    root.get("organization").get("organizationId"),
                    organizationId
            ));

            if (status != null) {
                predicates.add(criteriaBuilder.equal(
                        criteriaBuilder.lower(root.get("invoiceStatus").get("code")),
                        status.toLowerCase()
                ));
            }

            if (supplier != null) {
                String supplierPattern = "%" + supplier.toLowerCase() + "%";
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("supplier").get("name")),
                                supplierPattern
                        ),
                        criteriaBuilder.like(
                                criteriaBuilder.lower(root.get("supplier").get("legalName")),
                                supplierPattern
                        )
                ));
            }

            if (invoiceDate != null) {
                predicates.add(criteriaBuilder.equal(root.get("invoiceDate"), invoiceDate));
            }

            return criteriaBuilder.and(
                    predicates.toArray(new Predicate[0])
            );
        };
    }

    private record AppliedCorrection(String fieldName, String oldValue, String newValue) {
    }

}
