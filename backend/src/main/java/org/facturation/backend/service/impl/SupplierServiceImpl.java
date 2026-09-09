package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.dto.request.SupplierUpdateRequest;
import org.facturation.backend.dto.request.SupplierLegalIdentifierReplacementRequest;
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
import org.facturation.backend.repository.SupplierLegalIdentifierRepository;
import org.facturation.backend.model.SupplierLegalIdentifier;
import org.facturation.backend.model.SupplierLegalIdentifierSource;
import org.facturation.backend.model.SupplierLegalIdentifierType;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.FrenchLegalIdentifierValidator;
import org.facturation.backend.service.SupplierService;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.text.Normalizer;

@Service
public class SupplierServiceImpl implements SupplierService {

    private static final String ORGANIZATION_SIRET_UNIQUE_CONSTRAINT = "uk_suppliers_organization_siret";
    private final SupplierRepository supplierRepository;
    private final SupplierResponseMapper supplierResponseMapper;
    private final CurrentUserService currentUserService;
    private final FrenchLegalIdentifierValidator legalIdentifierValidator;
    private final SupplierLegalIdentifierRepository identifierRepository;

    public SupplierServiceImpl(
            SupplierRepository supplierRepository,
            SupplierResponseMapper supplierResponseMapper,
            CurrentUserService currentUserService,
            FrenchLegalIdentifierValidator legalIdentifierValidator,
            SupplierLegalIdentifierRepository identifierRepository
    ) {
        this.supplierRepository = supplierRepository;
        this.supplierResponseMapper = supplierResponseMapper;
        this.currentUserService = currentUserService;
        this.legalIdentifierValidator = legalIdentifierValidator;
        this.identifierRepository = identifierRepository;
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
        validateLegalIdentifierValues(supplier.getSiret(), supplier.getVatNumber(), "vatNumber");
        if (supplier.getSiret() != null && supplierRepository
                .findByOrganizationOrganizationIdAndSiret(
                        supplier.getOrganization().getOrganizationId(), supplier.getSiret())
                .filter(found -> !Objects.equals(found.getSupplierId(), supplier.getSupplierId()))
                .isPresent()) {
            throw new SupplierLegalIdentifierConflictException("siret");
        }
        return saveWithSiretConflictTranslation(supplier);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SupplierListItemResponse> findPage(String query, Pageable pageable) {
        Long organizationId = findCurrentOrganizationId();
        String trimmedQuery = isBlank(query) ? null : normalizeSearchText(query.trim());
        if (trimmedQuery == null) {
            return supplierRepository.findByOrganizationOrganizationId(organizationId, pageable)
                    .map(supplierResponseMapper::toListItemResponse);
        }
        String normalizedQuery = normalizeIdentifierValue(query.trim());
        Pageable rankedPageable = Pageable.ofSize(pageable.getPageSize()).withPage(pageable.getPageNumber());
        return supplierRepository.search(organizationId, trimmedQuery, normalizedQuery, rankedPageable)
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

        validateSupplierUpdateRequest(request, supplier);
        boolean changed = applyUpdates(supplier, request);
        if (!changed) {
            throw new InvalidSupplierException("At least one changed field is required");
        }

        supplier.setUpdatedAt(LocalDateTime.now());
        return supplierResponseMapper.toDetailsResponse(saveWithSiretConflictTranslation(supplier));
    }

    @Override
    @Transactional
    public SupplierDetailsResponse replaceLegalIdentifier(
            Long supplierId, Long identifierId, SupplierLegalIdentifierReplacementRequest request) {
        Long organizationId = findCurrentOrganizationId();
        Supplier supplier = supplierRepository.findBySupplierIdAndOrganizationOrganizationId(supplierId, organizationId)
                .orElseThrow(() -> new SupplierNotFoundException(supplierId));
        SupplierLegalIdentifier current = identifierRepository
                .findBySupplierLegalIdentifierIdAndSupplierSupplierIdAndOrganizationOrganizationId(
                        identifierId, supplierId, organizationId)
                .orElseThrow(() -> new InvalidSupplierException("Active legal identifier not found"));
        if (current.getValidTo() != null || request == null || isBlank(request.value()) || isBlank(request.reason())) {
            throw new InvalidSupplierException("A new value and a replacement reason are required");
        }
        String scheme = isBlank(request.scheme()) ? current.getScheme() : request.scheme().trim().toUpperCase(Locale.ROOT);
        String countryCode = isBlank(request.countryCode())
                ? current.getCountryCode() : normalizeCountryCode(request.countryCode());
        String normalizedValue = normalizeIdentifierValue(request.value());
        validateReplacementIdentifier(supplier, current, scheme, countryCode, normalizedValue);
        identifierRepository
                .findFirstByOrganizationOrganizationIdAndSchemeAndCountryCodeAndNormalizedValueAndValidToIsNull(
                        organizationId, scheme, countryCode, normalizedValue)
                .filter(found -> !found.getSupplier().getSupplierId().equals(supplierId))
                .ifPresent(found -> { throw new SupplierLegalIdentifierConflictException("legal identifier"); });

        LocalDate replacementDate = request.validFrom() == null ? LocalDate.now() : request.validFrom();
        if (current.getValidFrom() != null && replacementDate.isBefore(current.getValidFrom())) {
            throw new InvalidSupplierException("validFrom cannot be earlier than the current identifier validity");
        }
        current.setValidTo(replacementDate.minusDays(1));
        current.setChangeReason(request.reason().trim());
        current.setUpdatedAt(LocalDateTime.now());
        identifierRepository.save(current);

        SupplierLegalIdentifierType type;
        try {
            type = isBlank(request.type()) ? current.getType()
                    : SupplierLegalIdentifierType.valueOf(request.type().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new InvalidSupplierException("Unknown legal identifier type");
        }
        SupplierLegalIdentifier replacement = createIdentifier(supplier, type, scheme, countryCode,
                request.value().trim(), SupplierLegalIdentifierSource.MANUAL, true);
        replacement.setValidFrom(replacementDate);
        replacement.setCreatedByUser(currentUserService.getCurrentUser());
        replacement.setChangeReason(request.reason().trim());
        identifierRepository.save(replacement);

        if ("FR_SIRET".equals(scheme)) supplier.setSiret(normalizedValue);
        if ("EU_VAT".equals(scheme)) supplier.setVatNumber(normalizedValue);
        if (isBlank(supplier.getCountryCode())
                && current.getType() != SupplierLegalIdentifierType.VAT) {
            supplier.setCountryCode(countryCode);
        }
        supplier.setUpdatedAt(LocalDateTime.now());
        supplierRepository.save(supplier);
        return supplierResponseMapper.toDetailsResponse(supplier);
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
    public Supplier findRequiredByIdForOrganization(Long supplierId, Organization organization) {
        return supplierRepository.findBySupplierIdAndOrganizationOrganizationId(
                        supplierId,
                        organization.getOrganizationId()
                )
                .orElseThrow(() -> new SupplierNotFoundException(supplierId));
    }

    @Override
    public Optional<Supplier> findByLegalIdentifiers(Organization organization, String siret, String vatNumber) {
        Long organizationId = organization.getOrganizationId();
        Optional<Supplier> supplier = Optional.empty();

        if (!isBlank(siret)) {
            supplier = findByActiveIdentifier(organizationId, "FR_SIRET", "FR", siret);
            if (supplier.isEmpty()) {
                supplier = supplierRepository.findByOrganizationOrganizationIdAndSiret(
                        organizationId, normalizeIdentifierValue(siret));
            }
        }
        if (supplier.isEmpty() && !isBlank(vatNumber)) {
            String normalizedVat = normalizeIdentifierValue(vatNumber);
            String country = normalizedVat.length() >= 2 ? normalizedVat.substring(0, 2) : "FR";
            supplier = findByActiveIdentifier(organizationId, "EU_VAT", country, normalizedVat);
            if (supplier.isEmpty()) {
                supplier = supplierRepository.findByOrganizationOrganizationIdAndVatNumberIgnoreCase(
                        organizationId, normalizedVat);
            }
        }

        return supplier;
    }

    @Override
    @Transactional
    public Supplier resolveForInvoiceUpload(Long supplierId, Organization organization, OcrAnalysisResponse ocrAnalysis) {
        if (supplierId != null) {
            return findRequiredByIdForOrganization(supplierId, organization);
        }

        Optional<String> siret = extractOptionalNormalizedValue(ocrAnalysis, "siret").map(this::normalizeSiret);
        Optional<String> vatNumber = extractOptionalNormalizedValue(ocrAnalysis, "vatNumber")
                .map(this::normalizeVatNumber);
        validateLegalIdentifierValues(siret.orElse(null), vatNumber.orElse(null), "vatNumber");
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
        supplier.setCountryCode(siret != null ? "FR" : vatNumber.substring(0, 2));
        supplier.setCreatedAt(LocalDateTime.now());
        supplier.setUpdatedAt(LocalDateTime.now());
        Supplier saved = saveWithSiretConflictTranslation(supplier);
        if (siret != null) {
            createIdentifier(saved, SupplierLegalIdentifierType.ESTABLISHMENT, "FR_SIRET", "FR", siret,
                    SupplierLegalIdentifierSource.OCR, false);
            createIdentifier(saved, SupplierLegalIdentifierType.BUSINESS_REGISTRATION, "FR_SIREN", "FR",
                    siret.substring(0, 9), SupplierLegalIdentifierSource.OCR, false);
        }
        if (vatNumber != null) {
            createIdentifier(saved, SupplierLegalIdentifierType.VAT, "EU_VAT", vatNumber.substring(0, 2), vatNumber,
                    SupplierLegalIdentifierSource.OCR, false);
        }
        return saved;
    }

    private Supplier updateSupplierFromOcrIfNeeded(Supplier supplier, OcrAnalysisResponse ocrAnalysis) {
        Optional<String> extractedSiret = extractOptionalNormalizedValue(ocrAnalysis, "siret")
                .map(this::normalizeSiret);
        Optional<String> extractedVatNumber = extractOptionalNormalizedValue(ocrAnalysis, "vatNumber")
                .map(this::normalizeVatNumber);
        boolean updateSiret = isBlank(supplier.getSiret()) && extractedSiret.isPresent();
        boolean updateVatNumber = isBlank(supplier.getVatNumber()) && extractedVatNumber.isPresent();
        if (!updateSiret && !updateVatNumber) {
            return supplier;
        }

        String siret = updateSiret ? extractedSiret.get() : supplier.getSiret();
        String vatNumber = updateVatNumber ? extractedVatNumber.get() : supplier.getVatNumber();
        String inconsistentField = extractedVatNumber.isPresent() ? "vatNumber" : "siret";
        validateLegalIdentifierValues(siret, vatNumber, inconsistentField);

        supplier.setSiret(siret);
        supplier.setVatNumber(vatNumber);
        if (updateSiret) {
            supplier.setCountryCode("FR");
            createIdentifier(supplier, SupplierLegalIdentifierType.ESTABLISHMENT, "FR_SIRET", "FR", siret,
                    SupplierLegalIdentifierSource.OCR, false);
            createIdentifier(supplier, SupplierLegalIdentifierType.BUSINESS_REGISTRATION, "FR_SIREN", "FR",
                    siret.substring(0, 9), SupplierLegalIdentifierSource.OCR, false);
        }
        if (updateVatNumber) {
            String vatCountryCode = extractVatCountryCode(vatNumber);
            if (isBlank(supplier.getCountryCode())) {
                supplier.setCountryCode(vatCountryCode);
            }
            createIdentifier(supplier, SupplierLegalIdentifierType.VAT, "EU_VAT", vatCountryCode, vatNumber,
                    SupplierLegalIdentifierSource.OCR, false);
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
        changed |= applyOptionalValue(request.getEmail(), supplier.getEmail(), supplier::setEmail);
        changed |= applyOptionalValue(request.getPhone(), supplier.getPhone(), supplier::setPhone);
        changed |= applyOptionalValue(request.getAddress(), supplier.getAddress(), supplier::setAddress);
        return changed;
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

    private void validateSupplierUpdateRequest(
            SupplierUpdateRequest request,
            Supplier supplier
    ) {
        rejectLegacyIdentifierUpdate(request.getSiret(), supplier.getSiret(), "siret");
        rejectLegacyIdentifierUpdate(request.getVatNumber(), supplier.getVatNumber(), "vatNumber");
    }

    private String normalizeSiret(String value) {
        String siret = normalizeIdentifierToNullableValue(value);
        if (siret != null && !legalIdentifierValidator.isValidSiret(siret)) {
            throw new InvalidSupplierException("siret must be a valid French SIRET");
        }
        return siret;
    }

    private String normalizeVatNumber(String value) {
        String vatNumber = normalizeIdentifierToNullableValue(value);
        if (vatNumber == null) {
            return null;
        }
        return vatNumber;
    }

    private void validateLegalIdentifierValues(String siret, String vatNumber, String inconsistentField) {
        String normalizedSiret = siret == null ? null : normalizeSiret(siret);
        String normalizedVatNumber = vatNumber == null ? null : normalizeVatNumber(vatNumber);
        if (normalizedSiret != null && normalizedVatNumber != null
                && isFrenchVatNumber(normalizedVatNumber)
                && !legalIdentifierValidator.referToSameCompany(normalizedSiret, normalizedVatNumber)) {
            throw new InvalidSupplierException(
                    inconsistentField + " must refer to the same company as the other legal identifier"
            );
        }
    }

    private String toNullableValue(String value) {
        if (value == null) {
            return null;
        }
        String trimmedValue = value.trim();
        return trimmedValue.isEmpty() ? null : trimmedValue;
    }

    private String normalizeIdentifierToNullableValue(String value) {
        String trimmedValue = toNullableValue(value);
        return trimmedValue == null ? null : normalizeIdentifierValue(trimmedValue);
    }

    private Optional<Supplier> findByActiveIdentifier(
            Long organizationId, String scheme, String countryCode, String value) {
        return identifierRepository
                .findFirstByOrganizationOrganizationIdAndSchemeAndCountryCodeAndNormalizedValueAndValidToIsNull(
                        organizationId, scheme, countryCode, normalizeIdentifierValue(value))
                .map(SupplierLegalIdentifier::getSupplier);
    }

    private String normalizeIdentifierValue(String value) {
        return value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private String normalizeCountryCode(String value) {
        String countryCode = requireNotBlank(value, "countryCode").toUpperCase(Locale.ROOT);
        if (countryCode.length() != 2 || !countryCode.chars().allMatch(Character::isLetter)) {
            throw new InvalidSupplierException("countryCode must be a valid ISO 3166-1 alpha-2 code");
        }
        return countryCode;
    }

    private String normalizeSearchText(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    private SupplierLegalIdentifier createIdentifier(
            Supplier supplier,
            SupplierLegalIdentifierType type,
            String scheme,
            String countryCode,
            String value,
            SupplierLegalIdentifierSource source,
            boolean verified
    ) {
        String normalizedValue = normalizeIdentifierValue(value);
        Optional<SupplierLegalIdentifier> existingIdentifier = identifierRepository
                .findFirstByOrganizationOrganizationIdAndSchemeAndCountryCodeAndNormalizedValueAndValidToIsNull(
                        supplier.getOrganization().getOrganizationId(), scheme, countryCode, normalizedValue);
        if (existingIdentifier.isPresent()) {
            if (existingIdentifier.get().getSupplier().getSupplierId().equals(supplier.getSupplierId())) {
                return existingIdentifier.get();
            }
            throw new SupplierLegalIdentifierConflictException("legal identifier");
        }
        SupplierLegalIdentifier identifier = new SupplierLegalIdentifier();
        identifier.setOrganization(supplier.getOrganization());
        identifier.setSupplier(supplier);
        identifier.setType(type);
        identifier.setScheme(scheme);
        identifier.setCountryCode(countryCode);
        identifier.setValue(value);
        identifier.setNormalizedValue(normalizedValue);
        identifier.setSource(source);
        identifier.setVerified(verified);
        identifier.setCreatedAt(LocalDateTime.now());
        identifier.setUpdatedAt(LocalDateTime.now());
        return identifierRepository.save(identifier);
    }

    private void validateReplacementIdentifier(
            Supplier supplier,
            SupplierLegalIdentifier current,
            String scheme,
            String countryCode,
            String normalizedValue
    ) {
        if ("FR_SIRET".equals(scheme)) {
            if (!"FR".equals(countryCode)) {
                throw new InvalidSupplierException("FR_SIRET requires countryCode FR");
            }
            if (!legalIdentifierValidator.isValidSiret(normalizedValue)) {
                throw new InvalidSupplierException("siret must be a valid French SIRET");
            }
            findCurrentIdentifierValue(supplier.getSupplierId(), "FR_SIREN", "FR")
                    .filter(currentSiren -> !normalizedValue.startsWith(currentSiren))
                    .ifPresent(ignored -> {
                        throw new InvalidSupplierException(
                                "siret must keep the current French SIREN for this supplier"
                        );
                    });
            validateFrenchVatConsistency(normalizedValue, supplier.getSupplierId());
            return;
        }

        if ("FR_SIREN".equals(scheme)) {
            if (!"FR".equals(countryCode)) {
                throw new InvalidSupplierException("FR_SIREN requires countryCode FR");
            }
            if (!legalIdentifierValidator.isValidSiren(normalizedValue)) {
                throw new InvalidSupplierException("siren must be a valid French SIREN");
            }
            findCurrentIdentifierValue(supplier.getSupplierId(), "FR_SIRET", "FR")
                    .filter(currentSiret -> !currentSiret.startsWith(normalizedValue))
                    .ifPresent(ignored -> {
                        throw new InvalidSupplierException(
                                "siren must match the current French SIRET for this supplier"
                        );
                    });
            validateFrenchVatConsistency(normalizedValue + "00000", supplier.getSupplierId());
            return;
        }

        if ("EU_VAT".equals(scheme)) {
            if (normalizedValue.length() < 2) {
                throw new InvalidSupplierException("vatNumber must include an issuing country code");
            }
            String issuingCountryCode = extractVatCountryCode(normalizedValue);
            if (!countryCode.equals(issuingCountryCode)) {
                throw new InvalidSupplierException("countryCode must match the VAT issuing country");
            }
            if ("FR".equals(countryCode)) {
                findCurrentIdentifierValue(supplier.getSupplierId(), "FR_SIREN", "FR")
                        .filter(currentSiren -> !currentSiren.equals(extractSirenFromVatNumber(normalizedValue)))
                        .ifPresent(ignored -> {
                            throw new InvalidSupplierException(
                                    "vatNumber must refer to the same company as the other legal identifier"
                            );
                        });
            }
            return;
        }

        if (current.getType() == SupplierLegalIdentifierType.ESTABLISHMENT && !"FR".equals(countryCode)) {
            throw new InvalidSupplierException("French establishment identifiers require countryCode FR");
        }
    }

    private void validateFrenchVatConsistency(String siret, Long supplierId) {
        findCurrentIdentifierValue(supplierId, "EU_VAT", "FR")
                .filter(currentVatNumber -> !legalIdentifierValidator.referToSameCompany(siret, currentVatNumber))
                .ifPresent(ignored -> {
                    throw new InvalidSupplierException(
                            "vatNumber must refer to the same company as the other legal identifier"
                    );
                });
    }

    private Optional<String> findCurrentIdentifierValue(Long supplierId, String scheme, String countryCode) {
        return identifierRepository
                .findFirstBySupplierSupplierIdAndSchemeAndCountryCodeAndValidToIsNull(supplierId, scheme, countryCode)
                .map(SupplierLegalIdentifier::getNormalizedValue);
    }

    private void rejectLegacyIdentifierUpdate(String requestedValue, String currentValue, String fieldName) {
        if (requestedValue == null) {
            return;
        }
        if (Objects.equals(normalizeIdentifierToNullableValue(requestedValue), normalizeIdentifierToNullableValue(currentValue))) {
            return;
        }
        throw new InvalidSupplierException(
                fieldName + " must be updated through the legal identifier replacement endpoint"
        );
    }

    private boolean isFrenchVatNumber(String vatNumber) {
        return vatNumber.startsWith("FR");
    }

    private String extractVatCountryCode(String vatNumber) {
        return vatNumber.substring(0, 2);
    }

    private String extractSirenFromVatNumber(String vatNumber) {
        return vatNumber.substring(4);
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
