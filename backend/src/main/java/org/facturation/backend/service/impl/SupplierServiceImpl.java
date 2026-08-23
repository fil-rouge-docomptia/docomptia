package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.dto.request.SupplierUpdateRequest;
import org.facturation.backend.dto.response.SupplierDetailsResponse;
import org.facturation.backend.dto.response.SupplierListItemResponse;
import org.facturation.backend.exception.SupplierNotFoundException;
import org.facturation.backend.exception.SupplierLegalIdentifierConflictException;
import org.facturation.backend.exception.InvalidSupplierException;
import org.facturation.backend.mapper.SupplierResponseMapper;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.SupplierService;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class SupplierServiceImpl implements SupplierService {

    private static final String ORGANIZATION_SIRET_UNIQUE_CONSTRAINT = "uk_suppliers_organization_siret";
    private static final Pattern SIRET_PATTERN = Pattern.compile("\\d{14}");
    private static final Pattern FRENCH_VAT_NUMBER_PATTERN = Pattern.compile("FR[A-Z0-9]{2}\\d{9}");

    private final SupplierRepository supplierRepository;
    private final SupplierResponseMapper supplierResponseMapper;
    private final CurrentUserService currentUserService;

    public SupplierServiceImpl(
            SupplierRepository supplierRepository,
            SupplierResponseMapper supplierResponseMapper,
            CurrentUserService currentUserService
    ) {
        this.supplierRepository = supplierRepository;
        this.supplierResponseMapper = supplierResponseMapper;
        this.currentUserService = currentUserService;
    }

    @Override
    public List<Supplier> findAll() {
        return supplierRepository.findAll();
    }

    @Override
    public Optional<Supplier> findById(Long id) {
        return supplierRepository.findById(id);
    }

    @Override
    public Supplier save(Supplier supplier) {
        return saveWithSiretConflictTranslation(supplier);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SupplierListItemResponse> findPage(Pageable pageable) {
        Long organizationId = findCurrentOrganizationId();
        return supplierRepository.findByOrganizationOrganizationId(organizationId, pageable)
                .map(supplierResponseMapper::toListItemResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public SupplierDetailsResponse findDetailsById(Long id) {
        Long organizationId = findCurrentOrganizationId();
        return supplierRepository.findBySupplierIdAndOrganizationOrganizationId(id, organizationId)
                .map(supplierResponseMapper::toDetailsResponse)
                .orElseThrow(() -> new SupplierNotFoundException(id));
    }

    @Override
    @Transactional
    public SupplierDetailsResponse update(Long id, SupplierUpdateRequest request) {
        Long organizationId = findCurrentOrganizationId();
        Supplier supplier = supplierRepository.findBySupplierIdAndOrganizationOrganizationId(id, organizationId)
                .orElseThrow(() -> new SupplierNotFoundException(id));

        validateLegalIdentifiers(request, supplier, organizationId);
        boolean changed = applyUpdates(supplier, request);
        if (!changed) {
            throw new InvalidSupplierException("At least one changed field is required");
        }

        supplier.setUpdatedAt(LocalDateTime.now());
        return supplierResponseMapper.toDetailsResponse(saveWithSiretConflictTranslation(supplier));
    }

    @Override
    public Supplier findRequiredByName(Invoice invoice, String supplierName) {
        String normalizedSupplierName = requireNotBlank(supplierName, "supplierName");
        Long organizationId = invoice.getOrganization().getOrganizationId();
        return supplierRepository.findByOrganizationOrganizationIdAndNameIgnoreCase(organizationId, normalizedSupplierName)
                .or(() -> supplierRepository.findByOrganizationOrganizationIdAndLegalNameIgnoreCase(
                        organizationId,
                        normalizedSupplierName
                ))
                .orElseThrow(() -> new SupplierNotFoundException(normalizedSupplierName));
    }

    @Override
    public Optional<Supplier> findByLegalIdentifiers(Organization organization, String siret, String vatNumber) {
        Long organizationId = organization.getOrganizationId();
        Optional<Supplier> supplier = Optional.empty();

        if (!isBlank(siret)) {
            supplier = supplierRepository.findByOrganizationOrganizationIdAndSiret(organizationId, siret.trim());
        }
        if (supplier.isEmpty() && !isBlank(vatNumber)) {
            supplier = supplierRepository.findByOrganizationOrganizationIdAndVatNumberIgnoreCase(
                    organizationId,
                    vatNumber.trim()
            );
        }

        return supplier;
    }

    @Override
    public Supplier resolveForInvoiceUpload(Long supplierId, Organization organization, OcrAnalysisResponse ocrAnalysis) {
        if (supplierId != null) {
            return supplierRepository.findBySupplierIdAndOrganizationOrganizationId(
                            supplierId,
                            organization.getOrganizationId()
                    )
                    .orElseThrow(() -> new SupplierNotFoundException(supplierId));
        }

        Optional<String> siret = extractOptionalNormalizedValue(ocrAnalysis, "siret");
        Optional<String> vatNumber = extractOptionalNormalizedValue(ocrAnalysis, "vatNumber");
        Optional<Supplier> supplierByLegalIdentifier = findByLegalIdentifiers(
                organization,
                siret.orElse(null),
                vatNumber.orElse(null)
        );
        if (supplierByLegalIdentifier.isPresent()) {
            return updateSupplierFromOcrIfNeeded(supplierByLegalIdentifier.get(), ocrAnalysis);
        }

        Optional<String> supplierName = extractOptionalNormalizedValue(ocrAnalysis, "supplierName");
        if (supplierName.isEmpty()) {
            return null;
        }

        Optional<Supplier> supplierByName = supplierRepository.findByOrganizationOrganizationIdAndNameIgnoreCase(
                        organization.getOrganizationId(),
                        supplierName.get()
                )
                .or(() -> supplierRepository.findByOrganizationOrganizationIdAndLegalNameIgnoreCase(
                        organization.getOrganizationId(),
                        supplierName.get()
                ));
        if (supplierByName.isPresent()) {
            return updateSupplierFromOcrIfNeeded(supplierByName.get(), ocrAnalysis);
        }

        if (siret.isEmpty() && vatNumber.isEmpty()) {
            return null;
        }

        return createSupplierToVerify(
                organization,
                supplierName.get(),
                siret.orElse(null),
                vatNumber.orElse(null)
        );
    }

    private Supplier createSupplierToVerify(
            Organization organization,
            String supplierName,
            String siret,
            String vatNumber
    ) {
        Supplier supplier = new Supplier();
        supplier.setOrganization(organization);
        supplier.setName(supplierName);
        supplier.setLegalName(supplierName);
        supplier.setSiret(siret);
        supplier.setVatNumber(vatNumber);
        supplier.setCreatedAt(LocalDateTime.now());
        supplier.setUpdatedAt(LocalDateTime.now());
        return saveWithSiretConflictTranslation(supplier);
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
        return saveWithSiretConflictTranslation(supplier);
    }

    private Supplier saveWithSiretConflictTranslation(Supplier supplier) {
        try {
            return supplierRepository.saveAndFlush(supplier);
        } catch (DataIntegrityViolationException exception) {
            if (isOrganizationSiretConstraintViolation(exception)) {
                throw new SupplierLegalIdentifierConflictException("siret");
            }
            throw exception;
        }
    }

    private boolean isOrganizationSiretConstraintViolation(Throwable exception) {
        Throwable cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException constraintViolation) {
                String constraintName = constraintViolation.getConstraintName();
                return constraintName != null
                        && constraintName.toLowerCase(Locale.ROOT)
                        .contains(ORGANIZATION_SIRET_UNIQUE_CONSTRAINT);
            }
            cause = cause.getCause();
        }
        return false;
    }

    private Optional<String> extractOptionalNormalizedValue(OcrAnalysisResponse response, String fieldName) {
        return response.getFields().stream()
                .filter(field -> fieldName.equals(field.getFieldName()))
                .map(OcrFieldResponse::getNormalizedValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst();
    }

    private boolean applyUpdates(Supplier supplier, SupplierUpdateRequest request) {
        boolean changed = false;
        changed |= applyRequiredValue(request.getName(), supplier.getName(), supplier::setName, "name");
        changed |= applyRequiredValue(
                request.getLegalName(),
                supplier.getLegalName(),
                supplier::setLegalName,
                "legalName"
        );
        changed |= applySiret(request.getSiret(), supplier);
        changed |= applyVatNumber(request.getVatNumber(), supplier);
        changed |= applyOptionalValue(request.getEmail(), supplier.getEmail(), supplier::setEmail);
        changed |= applyOptionalValue(request.getPhone(), supplier.getPhone(), supplier::setPhone);
        changed |= applyOptionalValue(request.getAddress(), supplier.getAddress(), supplier::setAddress);
        return changed;
    }

    private boolean applySiret(String requestedValue, Supplier supplier) {
        if (requestedValue == null) {
            return false;
        }
        String siret = normalizeSiret(requestedValue);
        if (Objects.equals(supplier.getSiret(), siret)) {
            return false;
        }
        supplier.setSiret(siret);
        return true;
    }

    private boolean applyVatNumber(String requestedValue, Supplier supplier) {
        if (requestedValue == null) {
            return false;
        }
        String vatNumber = normalizeVatNumber(requestedValue);
        if (Objects.equals(supplier.getVatNumber(), vatNumber)) {
            return false;
        }
        supplier.setVatNumber(vatNumber);
        return true;
    }

    private boolean applyRequiredValue(
            String requestedValue,
            String currentValue,
            java.util.function.Consumer<String> setter,
            String fieldName
    ) {
        if (requestedValue == null) {
            return false;
        }
        if (isBlank(requestedValue)) {
            throw new InvalidSupplierException(fieldName + " is required");
        }
        String value = requestedValue.trim();
        if (Objects.equals(currentValue, value)) {
            return false;
        }
        setter.accept(value);
        return true;
    }

    private boolean applyOptionalValue(
            String requestedValue,
            String currentValue,
            java.util.function.Consumer<String> setter
    ) {
        if (requestedValue == null) {
            return false;
        }
        String value = toNullableValue(requestedValue);
        if (Objects.equals(currentValue, value)) {
            return false;
        }
        setter.accept(value);
        return true;
    }

    private void validateLegalIdentifiers(
            SupplierUpdateRequest request,
            Supplier supplier,
            Long organizationId
    ) {
        String siret = request.getSiret() == null ? null : normalizeSiret(request.getSiret());
        if (siret != null
                && supplierRepository.existsByOrganizationOrganizationIdAndSiretAndSupplierIdNot(
                        organizationId,
                        siret,
                        supplier.getSupplierId()
                )) {
            throw new SupplierLegalIdentifierConflictException("siret");
        }

        String vatNumber = request.getVatNumber() == null ? null : normalizeVatNumber(request.getVatNumber());
        if (vatNumber != null
                && supplierRepository.existsByOrganizationOrganizationIdAndVatNumberIgnoreCaseAndSupplierIdNot(
                        organizationId,
                        vatNumber,
                        supplier.getSupplierId()
                )) {
            throw new SupplierLegalIdentifierConflictException("vatNumber");
        }
    }

    private String normalizeSiret(String value) {
        String siret = toNullableValue(value);
        if (siret != null && !SIRET_PATTERN.matcher(siret).matches()) {
            throw new InvalidSupplierException("siret must contain exactly 14 digits");
        }
        return siret;
    }

    private String normalizeVatNumber(String value) {
        String vatNumber = toNullableValue(value);
        if (vatNumber == null) {
            return null;
        }
        vatNumber = vatNumber.toUpperCase(Locale.ROOT);
        if (!FRENCH_VAT_NUMBER_PATTERN.matcher(vatNumber).matches()) {
            throw new InvalidSupplierException("vatNumber must be a valid French VAT number");
        }
        return vatNumber;
    }

    private String toNullableValue(String value) {
        String trimmedValue = value.trim();
        return trimmedValue.isEmpty() ? null : trimmedValue;
    }

    private String requireNotBlank(String value, String fieldName) {
        if (isBlank(value)) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private Long findCurrentOrganizationId() {
        return currentUserService.getCurrentUser().getOrganization().getOrganizationId();
    }
}
