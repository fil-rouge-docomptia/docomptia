package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.UserCreateRequest;
import org.facturation.backend.dto.request.UserUpdateRequest;
import org.facturation.backend.exception.UserEmailConflictException;
import org.facturation.backend.exception.UserNotFoundException;
import org.facturation.backend.mapper.UserResponseMapper;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.RoleService;
import org.facturation.backend.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceImplTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private UserServiceImpl userService;
    private RoleService roleService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        roleService = mock(RoleService.class);
        passwordEncoder = new BCryptPasswordEncoder();
        userService = new UserServiceImpl(
                userRepository,
                passwordEncoder,
                new UserResponseMapper(),
                roleService,
                mock(AuditLogService.class)
        );
    }

    @Test
    void hashesPasswordBeforeSavingUser() {
        User user = new User();
        user.setPasswordHash("plain-password");
        when(userRepository.save(user)).thenReturn(user);

        userService.save(user);

        assertNotEquals("plain-password", user.getPasswordHash());
        assertTrue(passwordEncoder.matches("plain-password", user.getPasswordHash()));
        verify(userRepository).save(user);
    }

    @Test
    void changingPasswordCreatesANewHash() {
        User user = new User();
        String previousHash = passwordEncoder.encode("old-password");
        user.setPasswordHash(previousHash);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        userService.changePassword(1L, "new-password");

        assertNotEquals(previousHash, user.getPasswordHash());
        assertTrue(passwordEncoder.matches("new-password", user.getPasswordHash()));
        assertFalse(passwordEncoder.matches("old-password", user.getPasswordHash()));
    }

    @Test
    void invitesInactiveUserInAdministratorsOrganizationWithAllowedRole() {
        Organization organization = new Organization();
        organization.setOrganizationId(1L);
        Role role = new Role();
        role.setRoleId(2L);
        role.setCode(RoleCode.ACCOUNTANT.getCode());
        role.setLabel("Accountant");
        User administrator = administrator(organization);
        UserCreateRequest request = request(" NEW.USER@Example.com ", "ACCOUNTANT");

        when(userRepository.existsByEmailIgnoreCase("new.user@example.com")).thenReturn(false);
        when(roleService.findAssignableRole("ACCOUNTANT", 1L)).thenReturn(role);
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> {
            User savedUser = invocation.getArgument(0);
            savedUser.setUserId(10L);
            return savedUser;
        });

        var response = userService.invite(request, organization, administrator);

        assertEquals(10L, response.id());
        assertEquals("new.user@example.com", response.email());
        assertEquals("ACCOUNTANT", response.role().code());
        assertFalse(response.active());
        verify(userRepository).saveAndFlush(argThat(user ->
                user.getOrganization() == organization
                        && user.getRole() == role
                        && user.getEffectiveRoles().equals(Set.of(role))
                        && !user.isActive()
                        && user.getPasswordHash().startsWith("$2")
        ));
    }

    @Test
    void rejectsEmailAlreadyUsedWithDifferentCase() {
        Organization organization = new Organization();
        organization.setOrganizationId(1L);
        User administrator = administrator(organization);
        UserCreateRequest request = request("ADMIN@facturation-demo.fr", "ADMIN");
        when(userRepository.existsByEmailIgnoreCase("admin@facturation-demo.fr")).thenReturn(true);

        assertThrows(UserEmailConflictException.class, () -> userService.invite(request, organization, administrator));
    }

    @Test
    void updatesOnlyRequestedIdentityFieldsForOrganizationUser() {
        Organization organization = new Organization();
        organization.setOrganizationId(1L);
        Role role = new Role();
        role.setRoleId(2L);
        role.setCode(RoleCode.ACCOUNTANT.getCode());
        role.setLabel("Accountant");
        User user = new User();
        user.setUserId(10L);
        user.setOrganization(organization);
        user.setRole(role);
        user.setFirstName("Old");
        user.setLastName("Name");
        user.setEmail("old@example.com");
        UserUpdateRequest request = new UserUpdateRequest();
        request.setFirstName(" New ");
        request.setEmail(" NEW@Example.com ");

        when(userRepository.findByUserIdAndOrganizationOrganizationId(10L, 1L))
                .thenReturn(Optional.of(user));
        when(userRepository.existsByEmailIgnoreCaseAndUserIdNot("new@example.com", 10L)).thenReturn(false);
        when(userRepository.saveAndFlush(user)).thenReturn(user);

        var response = userService.update(10L, request, 1L);

        assertEquals("New", response.firstName());
        assertEquals("Name", response.lastName());
        assertEquals("new@example.com", response.email());
        verify(userRepository).saveAndFlush(user);
    }

    @Test
    void hidesUserOutsideOrganization() {
        UserUpdateRequest request = new UserUpdateRequest();
        request.setFirstName("New");
        when(userRepository.findByUserIdAndOrganizationOrganizationId(10L, 1L)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> userService.update(10L, request, 1L));
    }

    private UserCreateRequest request(String email, String roleCode) {
        UserCreateRequest request = new UserCreateRequest();
        request.setFirstName("New");
        request.setLastName("User");
        request.setEmail(email);
        request.setRoleCode(roleCode);
        return request;
    }

    private User administrator(Organization organization) {
        User administrator = new User();
        administrator.setUserId(1L);
        administrator.setOrganization(organization);
        return administrator;
    }
}
