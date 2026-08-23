package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.UserCreateRequest;
import org.facturation.backend.dto.response.UserListItemResponse;
import org.facturation.backend.exception.InvalidUserException;
import org.facturation.backend.exception.UserEmailConflictException;
import org.facturation.backend.mapper.UserResponseMapper;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.UserRepository;
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

    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            UserResponseMapper userResponseMapper,
            RoleService roleService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userResponseMapper = userResponseMapper;
        this.roleService = roleService;
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

        String email = requireValue(request.getEmail(), "email").toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new InvalidUserException("email must be valid");
        }
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

    private boolean isBcryptHash(String password) {
        return password != null && password.matches("^\\$2[ayb]\\$.{56}$");
    }
}
