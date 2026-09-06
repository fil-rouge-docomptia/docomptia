package org.facturation.backend.repository;

import org.facturation.backend.model.Permission;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.User;
import org.facturation.backend.security.RbacAuthorities;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class RbacRepositoryIntegrationTest {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Autowired
    RbacRepositoryIntegrationTest(UserRepository userRepository, RoleRepository roleRepository,
                                  PermissionRepository permissionRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
    }

    @Test
    void loadsPermissionCatalogueAndRequiredSystemRoles() {
        assertThat(permissionRepository.findByCode("invoice.approve")).isPresent();
        assertThat(roleRepository.findBySystemRoleTrue()).extracting(Role::getCode)
                .contains("OWNER", "ADMIN", "ACCOUNTING_MANAGER", "ACCOUNTANT", "APPROVER", "VIEWER");
    }

    @Test
    void combinesPermissionsFromSeveralUserRoles() {
        User user = userRepository.findById(1L).orElseThrow();
        Role viewer = roleRepository.findByCodeAndOrganizationIsNull("VIEWER").orElseThrow();
        Role approver = roleRepository.findByCodeAndOrganizationIsNull("APPROVER").orElseThrow();
        user.setRoles(Set.of(viewer, approver));
        userRepository.flush();

        assertThat(Arrays.stream(RbacAuthorities.from(user)).map(Object::toString))
                .contains("PERMISSION_invoice.read", "PERMISSION_invoice.approve");
    }

    @Test
    void permissionCodesAreUnique() {
        Permission permission = new Permission();
        permission.setCode("invoice.read");
        permission.setDomain("invoice");
        permission.setLabel("Duplicate");
        permission.setDescription("Duplicate");

        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class,
                () -> permissionRepository.saveAndFlush(permission));
    }
}
