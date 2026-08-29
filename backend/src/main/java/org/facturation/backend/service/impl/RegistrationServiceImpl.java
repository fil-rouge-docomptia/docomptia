package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.RegistrationRequest;
import org.facturation.backend.dto.response.RegistrationResponse;
import org.facturation.backend.exception.InvalidRegistrationException;
import org.facturation.backend.exception.OrganizationLegalIdentifierConflictException;
import org.facturation.backend.exception.UserEmailConflictException;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.RegistrationService;
import org.facturation.backend.service.RoleService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class RegistrationServiceImpl implements RegistrationService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern SIRET_PATTERN = Pattern.compile("\\d{14}");

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final RoleService roleService;
    private final PasswordEncoder passwordEncoder;

    public RegistrationServiceImpl(
            OrganizationRepository organizationRepository,
            UserRepository userRepository,
            RoleService roleService,
            PasswordEncoder passwordEncoder
    ) {
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.roleService = roleService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public RegistrationResponse register(RegistrationRequest request) {
        if (request == null) {
            throw new InvalidRegistrationException("Request body is required");
        }

        String organizationName = requireValue(request.getOrganizationName(), "organizationName");
        String legalName = requireValue(request.getLegalName(), "legalName");
        String siret = requireValue(request.getSiret(), "siret");
        String firstName = requireValue(request.getFirstName(), "firstName");
        String lastName = requireValue(request.getLastName(), "lastName");
        String email = normalizeEmail(request.getEmail());
        String password = requireValue(request.getPassword(), "password");

        if (!SIRET_PATTERN.matcher(siret).matches()) {
            throw new InvalidRegistrationException("siret must contain exactly 14 digits");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new UserEmailConflictException();
        }
        if (organizationRepository.existsBySiret(siret)) {
            throw new OrganizationLegalIdentifierConflictException();
        }

        Role adminRole = roleService.findByCode(RoleCode.ADMIN);
        LocalDateTime now = LocalDateTime.now();
        Organization organization = createOrganization(organizationName, legalName, siret, email, now);
        User administrator = createAdministrator(
                organization,
                adminRole,
                firstName,
                lastName,
                email,
                password,
                now
        );

        try {
            organizationRepository.saveAndFlush(organization);
        } catch (DataIntegrityViolationException exception) {
            throw new OrganizationLegalIdentifierConflictException();
        }

        try {
            userRepository.saveAndFlush(administrator);
        } catch (DataIntegrityViolationException exception) {
            throw new UserEmailConflictException();
        }

        return new RegistrationResponse(
                organization.getOrganizationId(),
                administrator.getUserId(),
                administrator.getEmail(),
                adminRole.getCode()
        );
    }

    private Organization createOrganization(
            String organizationName,
            String legalName,
            String siret,
            String email,
            LocalDateTime now
    ) {
        Organization organization = new Organization();
        organization.setName(organizationName);
        organization.setLegalName(legalName);
        organization.setSiret(siret);
        organization.setEmail(email);
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        return organization;
    }

    private User createAdministrator(
            Organization organization,
            Role role,
            String firstName,
            String lastName,
            String email,
            String password,
            LocalDateTime now
    ) {
        User administrator = new User();
        administrator.setOrganization(organization);
        administrator.setRole(role);
        administrator.setFirstName(firstName);
        administrator.setLastName(lastName);
        administrator.setEmail(email);
        administrator.setPasswordHash(passwordEncoder.encode(password));
        administrator.setActive(true);
        administrator.setCreatedAt(now);
        administrator.setUpdatedAt(now);
        return administrator;
    }

    private String normalizeEmail(String requestedEmail) {
        String email = requireValue(requestedEmail, "email").toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new InvalidRegistrationException("email must be valid");
        }
        return email;
    }

    private String requireValue(String requestedValue, String fieldName) {
        if (requestedValue == null || requestedValue.isBlank()) {
            throw new InvalidRegistrationException(fieldName + " is required");
        }
        return requestedValue.trim();
    }
}
