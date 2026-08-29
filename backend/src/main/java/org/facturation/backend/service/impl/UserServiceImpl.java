package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.UserCreateRequest;
import org.facturation.backend.dto.request.UserUpdateRequest;
import org.facturation.backend.dto.request.UserStatusUpdateRequest;
import org.facturation.backend.dto.request.UserRoleUpdateRequest;
import org.facturation.backend.dto.response.UserListItemResponse;
import org.facturation.backend.exception.InvalidUserException;
import org.facturation.backend.exception.UserEmailConflictException;
import org.facturation.backend.exception.UserNotFoundException;
import org.facturation.backend.mapper.UserResponseMapper;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.AuditLogService;
import org.facturation.backend.service.RoleService;
import org.facturation.backend.service.UserService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class UserServiceImpl implements UserService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserResponseMapper userResponseMapper;
    private final RoleService roleService;
    private final AuditLogService auditLogService;

    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            UserResponseMapper userResponseMapper,
            RoleService roleService,
            AuditLogService auditLogService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userResponseMapper = userResponseMapper;
        this.roleService = roleService;
        this.auditLogService = auditLogService;
    }

    @Override
    public List<User> findAll() {
        return userRepository.findAll();
    }

    @Override
    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }

    @Override
    public User findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("Authenticated user not found"));
    }

    @Override
    public User save(User user) {
        if (!isBcryptHash(user.getPasswordHash())) {
            user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        }
        return userRepository.save(user);
    }

    @Override
    public User changePassword(Long id, String rawPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        return userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserListItemResponse> findPageForOrganization(Long organizationId, Pageable pageable) {
        return userRepository.findByOrganizationOrganizationId(organizationId, pageable)
                .map(userResponseMapper::toListItemResponse);
    }

    @Override
    @Transactional
    public UserListItemResponse invite(UserCreateRequest request, Organization organization) {
        if (request == null) {
            throw new InvalidUserException("Request body is required");
        }

        String email = normalizeEmail(request.getEmail());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new UserEmailConflictException();
        }

        Role role = findAllowedRole(request.getRoleCode());
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setOrganization(organization);
        user.setRole(role);
        user.setFirstName(requireValue(request.getFirstName(), "firstName"));
        user.setLastName(requireValue(request.getLastName(), "lastName"));
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setActive(false);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        try {
            return userResponseMapper.toListItemResponse(userRepository.saveAndFlush(user));
        } catch (DataIntegrityViolationException exception) {
            throw new UserEmailConflictException();
        }
    }

    @Override
    @Transactional
    public UserListItemResponse update(Long id, UserUpdateRequest request, Long organizationId) {
        if (request == null) {
            throw new InvalidUserException("Request body is required");
        }

        User user = userRepository.findByUserIdAndOrganizationOrganizationId(id, organizationId)
                .orElseThrow(() -> new UserNotFoundException(id));

        boolean changed = false;
        if (request.getFirstName() != null) {
            String firstName = requireValue(request.getFirstName(), "firstName");
            if (!Objects.equals(user.getFirstName(), firstName)) {
                user.setFirstName(firstName);
                changed = true;
            }
        }
        if (request.getLastName() != null) {
            String lastName = requireValue(request.getLastName(), "lastName");
            if (!Objects.equals(user.getLastName(), lastName)) {
                user.setLastName(lastName);
                changed = true;
            }
        }
        if (request.getEmail() != null) {
            String email = normalizeEmail(request.getEmail());
            if (!Objects.equals(user.getEmail(), email)) {
                if (userRepository.existsByEmailIgnoreCaseAndUserIdNot(email, id)) {
                    throw new UserEmailConflictException();
                }
                user.setEmail(email);
                changed = true;
            }
        }
        if (!changed) {
            throw new InvalidUserException("At least one changed field is required");
        }

        user.setUpdatedAt(LocalDateTime.now());
        try {
            return userResponseMapper.toListItemResponse(userRepository.saveAndFlush(user));
        } catch (DataIntegrityViolationException exception) {
            throw new UserEmailConflictException();
        }
    }

    @Override
    @Transactional
    public UserListItemResponse updateStatus(Long id, UserStatusUpdateRequest request, User administrator) {
        if (request == null || request.getActive() == null) {
            throw new InvalidUserException("active is required");
        }

        Long organizationId = administrator.getOrganization().getOrganizationId();
        User user = userRepository.findByUserIdAndOrganizationOrganizationId(id, organizationId)
                .orElseThrow(() -> new UserNotFoundException(id));
        boolean requestedStatus = request.getActive();
        if (user.isActive() == requestedStatus) {
            throw new InvalidUserException("User already has the requested status");
        }

        boolean previousStatus = user.isActive();
        LocalDateTime now = LocalDateTime.now();
        user.setActive(requestedStatus);
        user.setUpdatedAt(now);
        User savedUser = userRepository.save(user);
        auditLogService.save(createStatusAuditLog(savedUser, administrator, previousStatus, now));
        return userResponseMapper.toListItemResponse(savedUser);
    }

    @Override
    @Transactional
    public UserListItemResponse updateRole(Long id, UserRoleUpdateRequest request, User administrator) {
        if (request == null) {
            throw new InvalidUserException("Request body is required");
        }

        Long organizationId = administrator.getOrganization().getOrganizationId();
        User user = userRepository.findByUserIdAndOrganizationOrganizationId(id, organizationId)
                .orElseThrow(() -> new UserNotFoundException(id));
        Role role = findAllowedRole(request.getRoleCode());
        if (user.getRole().getCode().equals(role.getCode())) {
            throw new InvalidUserException("User already has the requested role");
        }

        String previousRoleCode = user.getRole().getCode();
        LocalDateTime now = LocalDateTime.now();
        user.setRole(role);
        user.setUpdatedAt(now);
        User savedUser = userRepository.save(user);
        auditLogService.save(createRoleAuditLog(savedUser, administrator, previousRoleCode, now));
        return userResponseMapper.toListItemResponse(savedUser);
    }

    private AuditLog createStatusAuditLog(
            User user,
            User administrator,
            boolean previousStatus,
            LocalDateTime changedAt
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(administrator);
        auditLog.setEntityName(User.class.getSimpleName());
        auditLog.setEntityId(user.getUserId());
        auditLog.setAction("STATUS_CHANGED");
        auditLog.setOldValue("active=" + previousStatus);
        auditLog.setNewValue("active=" + user.isActive());
        auditLog.setCreatedAt(changedAt);
        return auditLog;
    }

    private AuditLog createRoleAuditLog(
            User user,
            User administrator,
            String previousRoleCode,
            LocalDateTime changedAt
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(administrator);
        auditLog.setEntityName(User.class.getSimpleName());
        auditLog.setEntityId(user.getUserId());
        auditLog.setAction("ROLE_CHANGED");
        auditLog.setOldValue("role=" + previousRoleCode);
        auditLog.setNewValue("role=" + user.getRole().getCode());
        auditLog.setCreatedAt(changedAt);
        return auditLog;
    }

    private Role findAllowedRole(String requestedRoleCode) {
        String roleCode = requireValue(requestedRoleCode, "roleCode").toUpperCase(Locale.ROOT);
        RoleCode allowedRole;
        try {
            allowedRole = RoleCode.fromCode(roleCode);
        } catch (IllegalStateException exception) {
            throw new InvalidUserException("roleCode is not allowed");
        }
        return roleService.findByCode(allowedRole);
    }

    private String requireValue(String requestedValue, String fieldName) {
        if (requestedValue == null || requestedValue.isBlank()) {
            throw new InvalidUserException(fieldName + " is required");
        }
        return requestedValue.trim();
    }

    private String normalizeEmail(String requestedEmail) {
        String email = requireValue(requestedEmail, "email").toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new InvalidUserException("email must be valid");
        }
        return email;
    }

    private boolean isBcryptHash(String password) {
        return password != null && password.matches("^\\$2[ayb]\\$.{56}$");
    }
}
