package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.mapper.AccountingEntryMapper;
import org.facturation.backend.mapper.InvoiceResponseMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.AccountingEntryService;
import org.facturation.backend.service.InvoiceOcrService;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
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
    private final AccountingEntryMapper accountingEntryMapper;
    private final InvoiceResponseMapper invoiceResponseMapper;
    private final InvoiceOcrService invoiceOcrService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final SupplierService supplierService;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceFileStorageService invoiceFileStorageService;

    public InvoiceServiceImpl(
            InvoiceRepository invoiceRepository,
            AccountingEntryService accountingEntryService,
            AccountingEntryMapper accountingEntryMapper,
            InvoiceResponseMapper invoiceResponseMapper,
            InvoiceOcrService invoiceOcrService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            SupplierService supplierService,
            OrganizationRepository organizationRepository,
            UserRepository userRepository,
            InvoiceFileRepository invoiceFileRepository,
            InvoiceFileStorageService invoiceFileStorageService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.accountingEntryService = accountingEntryService;
        this.accountingEntryMapper = accountingEntryMapper;
        this.invoiceResponseMapper = invoiceResponseMapper;
        this.invoiceOcrService = invoiceOcrService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.supplierService = supplierService;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.invoiceFileRepository = invoiceFileRepository;
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
        InvoiceStatus depositedStatus = invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.DEPOSEE);
        InvoiceStatus ocrInProgressStatus = invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.OCR_EN_COURS);
        InvoiceStatus extractedStatus = invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.EXTRAITE);

        OcrAnalysisResponse ocrAnalysis = invoiceOcrService.analyze(file);
        Supplier supplier = supplierService.resolveForInvoiceUpload(supplierId, organization, ocrAnalysis);
        Invoice invoice = createInvoice(organization, supplier, user, depositedStatus, ocrAnalysis);
        invoice = invoiceRepository.save(invoice);
        invoiceStatusWorkflowService.recordStatus(invoice, depositedStatus, user, "Invoice uploaded");

        InvoiceFile invoiceFile = saveInvoiceFile(invoice, file);

        invoiceStatusWorkflowService.updateStatus(invoice, ocrInProgressStatus, user, "OCR analysis started");

        invoiceOcrService.saveExtraction(invoice, ocrAnalysis);

        invoiceStatusWorkflowService.updateStatus(invoice, extractedStatus, user, "OCR analysis completed");

        return invoiceResponseMapper.toUploadResponse(invoice, invoiceFile, ocrAnalysis);
    }

    @Override
    @Transactional
    public List<InvoiceListItemResponse> searchInvoices(String status, String supplier, String invoiceDate) {
        String statusFilter = toNullableValue(status);
        String supplierFilter = toNullableValue(supplier);
        LocalDate invoiceDateFilter = parseOptionalDateFilter(invoiceDate);

        return invoiceRepository.findAll(buildInvoiceSearchSpecification(
                        statusFilter,
                        supplierFilter,
                        invoiceDateFilter
                ))
                .stream()
                .map(invoiceResponseMapper::toListItemResponse)
                .toList();
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> findDetailsById(Long id) {
        return invoiceRepository.findById(id).map(invoiceResponseMapper::toDetailsResponse);
    }

    @Override
    @Transactional
    public Optional<InvoiceDetailsResponse> correctInvoice(Long id, InvoiceCorrectionRequest request) {
        return invoiceRepository.findById(id).map(invoice -> {
            applyInvoiceCorrections(invoice, request);
            invoice.setUpdatedAt(LocalDateTime.now());
            Invoice savedInvoice = invoiceRepository.save(invoice);
            return invoiceResponseMapper.toDetailsResponse(savedInvoice);
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

    @Override
    @Transactional
    public Optional<AccountingEntryResponse> generateAccountingEntry(Long id) {
        return invoiceRepository.findById(id).map(invoice -> {
            User user = findDefaultUser();
            AccountingEntry accountingEntry = accountingEntryService.generateFromInvoice(invoice, user);
            InvoiceStatus accountedStatus = invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.COMPTABILISEE);
            invoiceStatusWorkflowService.updateStatusIfChanged(invoice, accountedStatus, user, "Accounting entry generated");
            return accountingEntryMapper.toResponse(
                    accountingEntry,
                    accountingEntryService.findLines(accountingEntry)
            );
        });
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
            invoice.setSupplier(supplierService.findRequiredByName(invoice, request.getSupplierName()));
        }
    }

    private Organization findDefaultOrganization() {
        return organizationRepository.findById(1L)
                .orElseThrow(() -> new IllegalStateException("Default organization not found"));
    }

    private User findDefaultUser() {
        return userRepository.findById(1L)
                .orElseThrow(() -> new IllegalStateException("Default user not found"));
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
        invoice.setCommandReference(invoiceOcrService.extractOptionalNormalizedValue(ocrAnalysis, "commandReference").orElse(null));
        invoice.setInvoiceDate(invoiceOcrService.extractDate(ocrAnalysis, "invoiceDate").orElse(LocalDate.now()));
        invoice.setDueDate(invoiceOcrService.extractDate(ocrAnalysis, "dueDate").orElse(null));
        invoice.setCurrencyCode("EUR");
        invoice.setTotalHt(invoiceOcrService.extractAmount(ocrAnalysis, "totalHt"));
        invoice.setTotalTva(invoiceOcrService.extractAmount(ocrAnalysis, "totalTva"));
        invoice.setTotalTtc(invoiceOcrService.extractAmount(ocrAnalysis, "totalTtc"));
        invoice.setDescription("Invoice uploaded for OCR analysis");
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoice;
    }

    private String extractInvoiceNumber(OcrAnalysisResponse ocrAnalysis) {
        return invoiceOcrService.extractNormalizedValue(ocrAnalysis, "invoiceNumber", "INV-" + System.currentTimeMillis());
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

    private Optional<InvoiceDetailsResponse> updateInvoiceStatus(Long invoiceId, String statusCode, String comment) {
        return invoiceRepository.findById(invoiceId).map(invoice -> {
            User user = findDefaultUser();
            InvoiceStatus status = invoiceStatusWorkflowService.findByCode(statusCode);
            invoiceStatusWorkflowService.updateStatus(invoice, status, user, comment);
            return invoiceResponseMapper.toDetailsResponse(invoice);
        });
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
            String status,
            String supplier,
            LocalDate invoiceDate
    ) {
        return (root, query, criteriaBuilder) -> {
            query.orderBy(criteriaBuilder.desc(root.get("createdAt")));
            List<Predicate> predicates = new ArrayList<>();

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
}
