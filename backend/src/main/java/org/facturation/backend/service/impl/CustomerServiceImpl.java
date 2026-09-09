package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.CustomerCreateRequest;
import org.facturation.backend.dto.request.CustomerUpdateRequest;
import org.facturation.backend.dto.response.CustomerResponse;
import org.facturation.backend.exception.CustomerLegalIdentifierConflictException;
import org.facturation.backend.exception.CustomerNotFoundException;
import org.facturation.backend.exception.InvalidCustomerException;
import org.facturation.backend.mapper.CustomerResponseMapper;
import org.facturation.backend.model.Customer;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.CustomerRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.CustomerService;
import org.facturation.backend.service.FrenchLegalIdentifierValidator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Objects;

@Service
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerResponseMapper customerResponseMapper;
    private final CurrentUserService currentUserService;
    private final FrenchLegalIdentifierValidator legalIdentifierValidator;

    public CustomerServiceImpl(
            CustomerRepository customerRepository,
            CustomerResponseMapper customerResponseMapper,
            CurrentUserService currentUserService,
            FrenchLegalIdentifierValidator legalIdentifierValidator
    ) {
        this.customerRepository = customerRepository;
        this.customerResponseMapper = customerResponseMapper;
        this.currentUserService = currentUserService;
        this.legalIdentifierValidator = legalIdentifierValidator;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CustomerResponse> findPage(Pageable pageable) {
        return customerRepository.findByOrganizationOrganizationId(findCurrentOrganization().getOrganizationId(), pageable)
                .map(customerResponseMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerResponse findDetailsById(Long id) {
        return customerResponseMapper.toResponse(findRequiredCustomer(id));
    }

    @Override
    @Transactional
    public CustomerResponse create(CustomerCreateRequest request) {
        Organization organization = findCurrentOrganization();
        Customer customer = new Customer();
        customer.setOrganization(organization);
        applyCreateValues(customer, request);
        ensureLegalIdentifiersAvailable(customer, null);
        customer.setActive(true);
        LocalDateTime now = LocalDateTime.now();
        customer.setCreatedAt(now);
        customer.setUpdatedAt(now);
        return customerResponseMapper.toResponse(saveWithConflictTranslation(customer));
    }

    @Override
    @Transactional
    public CustomerResponse update(Long id, CustomerUpdateRequest request) {
        Customer customer = findRequiredCustomer(id);
        boolean changed = applyUpdateValues(customer, request);
        if (!changed) {
            throw new InvalidCustomerException("At least one changed field is required");
        }
        ensureLegalIdentifiersAvailable(customer, id);
        customer.setUpdatedAt(LocalDateTime.now());
        return customerResponseMapper.toResponse(saveWithConflictTranslation(customer));
    }

    @Override
    @Transactional
    public CustomerResponse deactivate(Long id) {
        Customer customer = findRequiredCustomer(id);
        if (!customer.isActive()) {
            throw new InvalidCustomerException("Customer is already inactive");
        }
        customer.setActive(false);
        customer.setUpdatedAt(LocalDateTime.now());
        return customerResponseMapper.toResponse(customerRepository.save(customer));
    }

    private void applyCreateValues(Customer customer, CustomerCreateRequest request) {
        if (request == null) {
            throw new InvalidCustomerException("Customer details are required");
        }
        customer.setName(requireValue(request.getName(), "name"));
        customer.setLegalName(requireValue(request.getLegalName(), "legalName"));
        customer.setSiret(normalizeSiret(request.getSiret()));
        customer.setVatNumber(normalizeVatNumber(request.getVatNumber()));
        validateLegalIdentifiers(customer.getSiret(), customer.getVatNumber());
        customer.setEmail(toNullableValue(request.getEmail()));
        customer.setPhone(toNullableValue(request.getPhone()));
        customer.setAddress(toNullableValue(request.getAddress()));
    }

    private boolean applyUpdateValues(Customer customer, CustomerUpdateRequest request) {
        if (request == null) {
            throw new InvalidCustomerException("Customer details are required");
        }
        boolean changed = false;
        changed |= applyRequiredValue(request.getName(), customer.getName(), customer::setName, "name");
        changed |= applyRequiredValue(request.getLegalName(), customer.getLegalName(), customer::setLegalName, "legalName");
        changed |= applyIdentifierValue(request.getSiret(), customer.getSiret(), customer::setSiret, true);
        changed |= applyIdentifierValue(request.getVatNumber(), customer.getVatNumber(), customer::setVatNumber, false);
        changed |= applyOptionalValue(request.getEmail(), customer.getEmail(), customer::setEmail);
        changed |= applyOptionalValue(request.getPhone(), customer.getPhone(), customer::setPhone);
        changed |= applyOptionalValue(request.getAddress(), customer.getAddress(), customer::setAddress);
        validateLegalIdentifiers(customer.getSiret(), customer.getVatNumber());
        return changed;
    }

    private void ensureLegalIdentifiersAvailable(Customer customer, Long excludedCustomerId) {
        Long organizationId = customer.getOrganization().getOrganizationId();
        if (customer.getSiret() != null && (excludedCustomerId == null
                ? customerRepository.existsByOrganizationOrganizationIdAndSiret(organizationId, customer.getSiret())
                : customerRepository.existsByOrganizationOrganizationIdAndSiretAndCustomerIdNot(
                        organizationId, customer.getSiret(), excludedCustomerId))) {
            throw new CustomerLegalIdentifierConflictException("siret");
        }
        if (customer.getVatNumber() != null && (excludedCustomerId == null
                ? customerRepository.existsByOrganizationOrganizationIdAndVatNumber(organizationId, customer.getVatNumber())
                : customerRepository.existsByOrganizationOrganizationIdAndVatNumberAndCustomerIdNot(
                        organizationId, customer.getVatNumber(), excludedCustomerId))) {
            throw new CustomerLegalIdentifierConflictException("vatNumber");
        }
    }

    private Customer findRequiredCustomer(Long id) {
        Long organizationId = findCurrentOrganization().getOrganizationId();
        return customerRepository.findByCustomerIdAndOrganizationOrganizationId(id, organizationId)
                .orElseThrow(() -> new CustomerNotFoundException(id));
    }

    private Customer saveWithConflictTranslation(Customer customer) {
        try {
            return customerRepository.saveAndFlush(customer);
        } catch (DataIntegrityViolationException exception) {
            throw new CustomerLegalIdentifierConflictException("legal identifier");
        }
    }

    private void validateLegalIdentifiers(String siret, String vatNumber) {
        if (siret != null && !legalIdentifierValidator.isValidSiret(siret)) {
            throw new InvalidCustomerException("siret must be a valid French SIRET");
        }
        if (vatNumber != null && vatNumber.startsWith("FR") && !legalIdentifierValidator.isValidVatNumber(vatNumber)) {
            throw new InvalidCustomerException("vatNumber must be a valid French VAT number");
        }
        if (siret != null && vatNumber != null && vatNumber.startsWith("FR")
                && !legalIdentifierValidator.referToSameCompany(siret, vatNumber)) {
            throw new InvalidCustomerException("vatNumber must refer to the same company as siret");
        }
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
        String value = requireValue(requestedValue, fieldName);
        if (Objects.equals(currentValue, value)) {
            return false;
        }
        setter.accept(value);
        return true;
    }

    private boolean applyIdentifierValue(
            String requestedValue,
            String currentValue,
            java.util.function.Consumer<String> setter,
            boolean siret
    ) {
        if (requestedValue == null) {
            return false;
        }
        String value = siret ? normalizeSiret(requestedValue) : normalizeVatNumber(requestedValue);
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

    private String requireValue(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new InvalidCustomerException(fieldName + " is required");
        }
        return value.trim();
    }

    private String normalizeSiret(String value) {
        String normalized = normalizeIdentifierToNullable(value);
        if (normalized != null && !normalized.matches("\\d{14}")) {
            throw new InvalidCustomerException("siret must contain 14 digits");
        }
        return normalized;
    }

    private String normalizeVatNumber(String value) {
        String normalized = normalizeIdentifierToNullable(value);
        if (normalized != null && !normalized.matches("[A-Z]{2}[A-Z0-9]+")) {
            throw new InvalidCustomerException("vatNumber must include an issuing country code");
        }
        return normalized;
    }

    private String normalizeIdentifierToNullable(String value) {
        String nullableValue = toNullableValue(value);
        return nullableValue == null ? null : nullableValue.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private String toNullableValue(String value) {
        if (value == null) {
            return null;
        }
        String trimmedValue = value.trim();
        return trimmedValue.isEmpty() ? null : trimmedValue;
    }

    private Organization findCurrentOrganization() {
        return currentUserService.getCurrentUser().getOrganization();
    }
}
