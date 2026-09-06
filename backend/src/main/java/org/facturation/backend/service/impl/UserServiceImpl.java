package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.UserCreateRequest;
import org.facturation.backend.dto.request.UserUpdateRequest;
import org.facturation.backend.dto.request.UserStatusUpdateRequest;
import org.facturation.backend.dto.request.UserRoleUpdateRequest;
import org.facturation.backend.dto.response.UserListItemResponse;
import org.facturation.backend.exception.InvalidUserException;
import org.facturation.backend.exception.LastActiveOwnerException;
import org.facturation.backend.exception.UserEmailConflictException;
import org.facturation.backend.exception.UserNotFoundException;
import org.facturation.backend.mapper.UserResponseMapper;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.security.BusinessPermission;
import org.facturation.backend.security.PermissionAuthority;
import org.facturation.backend.service.AuditLogService;
import org.facturation.backend.service.RoleService;
import org.facturation.backend.service.UserService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

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
    public UserListItemResponse invite(UserCreateRequest request, Organization organization, User administrator) {
        if (request == null) {
            throw new InvalidUserException("Request body is required");
        }

        String email = normalizeEmail(request.getEmail());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new UserEmailConflictException();
        }

        Set<Role> roles = findAllowedRoles(request.getRoleCodes(), request.getRoleCode(), organization.getOrganizationId());
        ensureOwnerRoleChangeIsAllowed(Set.of(), roles, administrator);
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setOrganization(organization);
        user.setRoles(roles);
        user.setFirstName(requireValue(request.getFirstName(), "firstName"));
        user.setLastName(requireValue(request.getLastName(), "lastName"));
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setActive(false);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        try {
            User savedUser = userRepository.saveAndFlush(user);
            auditLogService.save(createRolesAuditLog(savedUser, administrator, Set.of(), roles, now));
            return userResponseMapper.toListItemResponse(savedUser);
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
        if (!requestedStatus) {
            ensureAnotherActiveOwnerExists(user, organizationId);
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
        Set<Role> requestedRoles = findAllowedRoles(request.getRoleCodes(), request.getRoleCode(), organizationId);
        Set<Role> previousRoles = user.getEffectiveRoles();
        if (roleCodes(previousRoles).equals(roleCodes(requestedRoles))) {
            throw new InvalidUserException("User already has the requested roles");
        }
        ensureOwnerRoleChangeIsAllowed(previousRoles, requestedRoles, administrator);
        if (!includesRoleCode(requestedRoles, RoleCode.OWNER)) {
            ensureAnotherActiveOwnerExists(user, organizationId);
        }

        LocalDateTime now = LocalDateTime.now();
        user.setRoles(requestedRoles);
        user.setUpdatedAt(now);
        User savedUser = userRepository.save(user);
        auditLogService.save(createRolesAuditLog(savedUser, administrator, previousRoles, requestedRoles, now));
        return userResponseMapper.toListItemResponse(savedUser);
    }

    private void ensureAnotherActiveOwnerExists(User user, Long organizationId) {
        if (!user.isActive() || !includesRoleCode(user.getEffectiveRoles(), RoleCode.OWNER)) {
            return;
        }

        boolean anotherActiveOwnerExists = userRepository
                .findActiveOwnersForUpdate(organizationId)
                .stream()
                .anyMatch(owner -> !owner.getUserId().equals(user.getUserId()));
        if (!anotherActiveOwnerExists) {
            throw new LastActiveOwnerException();
        }
    }

    private void ensureOwnerRoleChangeIsAllowed(Set<Role> previousRoles, Set<Role> requestedRoles, User administrator) {
        boolean ownerRoleChanges =
                includesRoleCode(previousRoles, RoleCode.OWNER) != includesRoleCode(requestedRoles, RoleCode.OWNER);
        if (!ownerRoleChanges) {
            return;
        }
        if (!PermissionAuthority.hasPermission(administrator, BusinessPermission.MEMBER_OWNER_MANAGE)) {
            throw new AccessDeniedException("Owner role management requires member.owner.manage");
        }
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

    private AuditLog createRolesAuditLog(
            User user,
            User administrator,
            Set<Role> previousRoles,
            Set<Role> requestedRoles,
            LocalDateTime changedAt
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(administrator);
        auditLog.setEntityName(User.class.getSimpleName());
        auditLog.setEntityId(user.getUserId());
        auditLog.setAction("ROLES_CHANGED");
        auditLog.setOldValue("roles=" + String.join(",", roleCodes(previousRoles)));
        auditLog.setNewValue("roles=" + String.join(",", roleCodes(requestedRoles)));
        auditLog.setCreatedAt(changedAt);
        return auditLog;
    }

    private Set<Role> findAllowedRoles(List<String> requestedRoleCodes, String requestedRoleCode, Long organizationId) {
        List<String> roleCodes = requestedRoleCodes == null || requestedRoleCodes.isEmpty()
                ? List.of(requireValue(requestedRoleCode, "roleCode"))
                : requestedRoleCodes;
        LinkedHashSet<Role> roles = new LinkedHashSet<>();
        for (String requestedCode : roleCodes) {
            String roleCode = requireValue(requestedCode, "roleCode").toUpperCase(Locale.ROOT);
            try {
                roles.add(roleService.findAssignableRole(roleCode, organizationId));
            } catch (IllegalArgumentException exception) {
                throw new InvalidUserException(exception.getMessage());
            }
        }
        if (roles.isEmpty()) {
            throw new InvalidUserException("At least one role is required");
        }
        return roles;
    }

    private boolean includesRoleCode(Set<Role> roles, RoleCode roleCode) {
        return roles.stream().anyMatch(role -> roleCode.getCode().equals(role.getCode()));
    }

    private List<String> roleCodes(Set<Role> roles) {
        return roles.stream()
                .map(Role::getCode)
                .sorted()
                .collect(Collectors.toList());
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
