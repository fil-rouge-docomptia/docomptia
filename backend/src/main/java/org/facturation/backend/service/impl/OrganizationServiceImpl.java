package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.OrganizationUpdateRequest;
import org.facturation.backend.dto.request.ValidationPreferencesUpdateRequest;
import org.facturation.backend.dto.response.OrganizationResponse;
import org.facturation.backend.dto.response.ValidationPreferencesResponse;
import org.facturation.backend.exception.InvalidOrganizationException;
import org.facturation.backend.exception.OrganizationLegalIdentifierConflictException;
import org.facturation.backend.mapper.OrganizationResponseMapper;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.service.AuditLogService;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.FrenchLegalIdentifierValidator;
import org.facturation.backend.service.OrganizationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class OrganizationServiceImpl implements OrganizationService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final BigDecimal MAX_VALIDATION_THRESHOLD = new BigDecimal("9999999999.99");
    private final OrganizationRepository organizationRepository;
    private final CurrentUserService currentUserService;
    private final OrganizationResponseMapper organizationResponseMapper;
    private final AuditLogService auditLogService;
    private final FrenchLegalIdentifierValidator legalIdentifierValidator;

    public OrganizationServiceImpl(
            OrganizationRepository organizationRepository,
            CurrentUserService currentUserService,
            OrganizationResponseMapper organizationResponseMapper,
            AuditLogService auditLogService,
            FrenchLegalIdentifierValidator legalIdentifierValidator
    ) {
        this.organizationRepository = organizationRepository;
        this.currentUserService = currentUserService;
        this.organizationResponseMapper = organizationResponseMapper;
        this.auditLogService = auditLogService;
        this.legalIdentifierValidator = legalIdentifierValidator;
    }

    @Override
    public List<Organization> findAll() {
        return organizationRepository.findAll();
    }

    @Override
    public Optional<Organization> findById(Long id) {
        return organizationRepository.findById(id);
    }

    @Override
    public Organization save(Organization organization) {
        return organizationRepository.save(organization);
    }

    @Override
    @Transactional(readOnly = true)
    public OrganizationResponse findCurrentOrganization() {
        return organizationResponseMapper.toResponse(currentUserService.getCurrentUser().getOrganization());
    }

    @Override
    @Transactional
    public OrganizationResponse updateCurrentOrganization(OrganizationUpdateRequest request) {
        if (request == null) {
            throw new InvalidOrganizationException("Request body is required");
        }

        User user = currentUserService.getCurrentUser();
        Organization organization = user.getOrganization();
        NormalizedOrganizationUpdate update = normalize(request);
        validateSiretAvailability(update.siret(), organization.getOrganizationId());

        LocalDateTime now = LocalDateTime.now();
        List<AuditLog> auditLogs = applyUpdates(organization, user, update, now);
        if (auditLogs.isEmpty()) {
            throw new InvalidOrganizationException("At least one changed field is required");
        }

        organization.setUpdatedAt(now);
        Organization savedOrganization;
        try {
            savedOrganization = organizationRepository.saveAndFlush(organization);
        } catch (org.springframework.dao.DataIntegrityViolationException exception) {
            throw new OrganizationLegalIdentifierConflictException();
        }
        auditLogs.forEach(auditLogService::save);
        return organizationResponseMapper.toResponse(savedOrganization);
    }

    @Override
    @Transactional(readOnly = true)
    public ValidationPreferencesResponse findCurrentValidationPreferences() {
        return toValidationPreferencesResponse(currentUserService.getCurrentUser().getOrganization());
    }

    @Override
    @Transactional
    public ValidationPreferencesResponse updateCurrentValidationPreferences(
            ValidationPreferencesUpdateRequest request
    ) {
        validateValidationPreferences(request);

        User user = currentUserService.getCurrentUser();
        Organization organization = user.getOrganization();
        boolean validationRequired = request.getValidationRequired();
        BigDecimal validationThreshold = normalizeValidationThreshold(request.getValidationThreshold());
        if (organization.isValidationRequired() == validationRequired
                && Objects.equals(organization.getValidationThreshold(), validationThreshold)) {
            throw new InvalidOrganizationException("At least one changed validation preference is required");
        }

        LocalDateTime now = LocalDateTime.now();
        List<AuditLog> auditLogs = new ArrayList<>();
        if (organization.isValidationRequired() != validationRequired) {
            auditLogs.add(createAuditLog(
                    organization,
                    user,
                    "validationRequired",
                    Boolean.toString(organization.isValidationRequired()),
                    Boolean.toString(validationRequired),
                    now
            ));
            organization.setValidationRequired(validationRequired);
        }
        if (!Objects.equals(organization.getValidationThreshold(), validationThreshold)) {
            auditLogs.add(createAuditLog(
                    organization,
                    user,
                    "validationThreshold",
                    organization.getValidationThreshold() == null
                            ? null
                            : organization.getValidationThreshold().toPlainString(),
                    validationThreshold == null ? null : validationThreshold.toPlainString(),
                    now
            ));
            organization.setValidationThreshold(validationThreshold);
        }

        organization.setUpdatedAt(now);
        Organization savedOrganization = organizationRepository.save(organization);
        auditLogs.forEach(auditLogService::save);
        return toValidationPreferencesResponse(savedOrganization);
    }

    private void validateValidationPreferences(ValidationPreferencesUpdateRequest request) {
        if (request == null || request.getValidationRequired() == null) {
            throw new InvalidOrganizationException("validationRequired is required");
        }
        if (!request.getValidationRequired() && request.getValidationThreshold() != null) {
            throw new InvalidOrganizationException(
                    "validationThreshold must be omitted when validationRequired is false"
            );
        }
    }

    private BigDecimal normalizeValidationThreshold(BigDecimal validationThreshold) {
        if (validationThreshold == null) {
            return null;
        }
        if (validationThreshold.signum() <= 0) {
            throw new InvalidOrganizationException("validationThreshold must be greater than zero");
        }
        if (validationThreshold.scale() > 2) {
            throw new InvalidOrganizationException("validationThreshold must have at most two decimal places");
        }
        if (validationThreshold.compareTo(MAX_VALIDATION_THRESHOLD) > 0) {
            throw new InvalidOrganizationException("validationThreshold is too large");
        }
        return validationThreshold.setScale(2);
    }

    private ValidationPreferencesResponse toValidationPreferencesResponse(Organization organization) {
        return new ValidationPreferencesResponse(
                organization.isValidationRequired(),
                organization.getValidationThreshold()
        );
    }

    private NormalizedOrganizationUpdate normalize(OrganizationUpdateRequest request) {
        String name = normalizeRequired(request.getName(), "name");
        String legalName = normalizeRequired(request.getLegalName(), "legalName");
        String siret = normalizeSiret(request.getSiret());
        String email = normalizeEmail(request.getEmail());
        String phone = normalizeOptional(request.getPhone());
        String address = normalizeOptional(request.getAddress());
        String defaultCurrencyCode = normalizeCurrencyCode(request.getDefaultCurrencyCode());
        return new NormalizedOrganizationUpdate(name, legalName, siret, email, phone, address, defaultCurrencyCode);
    }

    private String normalizeRequired(String value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value.isBlank()) {
            throw new InvalidOrganizationException(fieldName + " is required");
        }
        return value.trim();
    }

    private String normalizeSiret(String value) {
        String siret = normalizeRequired(value, "siret");
        if (siret != null && !legalIdentifierValidator.isValidSiret(siret)) {
            throw new InvalidOrganizationException("siret must be a valid French SIRET");
        }
        return siret;
    }

    private String normalizeEmail(String value) {
        String email = normalizeRequired(value, "email");
        if (email == null) {
            return null;
        }
        email = email.toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new InvalidOrganizationException("email must be valid");
        }
        return email;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String normalizedValue = value.trim();
        return normalizedValue.isEmpty() ? "" : normalizedValue;
    }

    private String normalizeCurrencyCode(String value) {
        if (value == null) {
            return null;
        }
        String currencyCode = value.trim().toUpperCase(Locale.ROOT);
        try {
            return Currency.getInstance(currencyCode).getCurrencyCode();
        } catch (IllegalArgumentException exception) {
            throw new InvalidOrganizationException("defaultCurrencyCode must be a recognized ISO 4217 code");
        }
    }

    private void validateSiretAvailability(String siret, Long organizationId) {
        if (siret != null && organizationRepository.existsBySiretAndOrganizationIdNot(siret, organizationId)) {
            throw new OrganizationLegalIdentifierConflictException();
        }
    }

    private List<AuditLog> applyUpdates(
            Organization organization,
            User user,
            NormalizedOrganizationUpdate update,
            LocalDateTime changedAt
    ) {
        List<AuditLog> auditLogs = new ArrayList<>();
        applyValue(organization, user, "name", organization.getName(), update.name(), organization::setName,
                changedAt, auditLogs);
        applyValue(organization, user, "legalName", organization.getLegalName(), update.legalName(),
                organization::setLegalName, changedAt, auditLogs);
        applyValue(organization, user, "siret", organization.getSiret(), update.siret(), organization::setSiret,
                changedAt, auditLogs);
        applyValue(organization, user, "email", organization.getEmail(), update.email(), organization::setEmail,
                changedAt, auditLogs);
        applyOptionalValue(organization, user, "phone", organization.getPhone(), update.phone(),
                organization::setPhone, changedAt, auditLogs);
        applyOptionalValue(organization, user, "address", organization.getAddress(), update.address(),
                organization::setAddress, changedAt, auditLogs);
        applyValue(organization, user, "defaultCurrencyCode", organization.getDefaultCurrencyCode(),
                update.defaultCurrencyCode(), organization::setDefaultCurrencyCode, changedAt, auditLogs);
        return auditLogs;
    }

    private void applyOptionalValue(
            Organization organization,
            User user,
            String fieldName,
            String currentValue,
            String requestedValue,
            java.util.function.Consumer<String> setter,
            LocalDateTime changedAt,
            List<AuditLog> auditLogs
    ) {
        if (requestedValue == null) {
            return;
        }
        String nullableValue = toNullable(requestedValue);
        if (Objects.equals(currentValue, nullableValue)) {
            return;
        }
        setter.accept(nullableValue);
        auditLogs.add(createAuditLog(organization, user, fieldName, currentValue, nullableValue, changedAt));
    }

    private void applyValue(
            Organization organization,
            User user,
            String fieldName,
            String currentValue,
            String requestedValue,
            java.util.function.Consumer<String> setter,
            LocalDateTime changedAt,
            List<AuditLog> auditLogs
    ) {
        if (requestedValue == null || Objects.equals(currentValue, requestedValue)) {
            return;
        }
        setter.accept(requestedValue);
        auditLogs.add(createAuditLog(organization, user, fieldName, currentValue, requestedValue, changedAt));
    }

    private String toNullable(String value) {
        return value != null && value.isEmpty() ? null : value;
    }

    private AuditLog createAuditLog(
            Organization organization,
            User user,
            String fieldName,
            String oldValue,
            String newValue,
            LocalDateTime changedAt
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(organization);
        auditLog.setUser(user);
        auditLog.setEntityName(Organization.class.getSimpleName());
        auditLog.setEntityId(organization.getOrganizationId());
        auditLog.setAction("UPDATED");
        auditLog.setOldValue(fieldName + "=" + Objects.toString(oldValue, ""));
        auditLog.setNewValue(fieldName + "=" + Objects.toString(newValue, ""));
        auditLog.setCreatedAt(changedAt);
        return auditLog;
    }

    private record NormalizedOrganizationUpdate(
            String name,
            String legalName,
            String siret,
            String email,
            String phone,
            String address,
            String defaultCurrencyCode
    ) {
    }
}
