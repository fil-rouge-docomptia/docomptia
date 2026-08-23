package org.facturation.backend.service.impl;

import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.service.RoleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
class RoleServiceIntegrationTest {

    private final RoleRepository roleRepository;
    private final RoleService roleService;

    @Autowired
    RoleServiceIntegrationTest(RoleRepository roleRepository, RoleService roleService) {
        this.roleRepository = roleRepository;
        this.roleService = roleService;
    }

    @Test
    void alignsJavaRoleCodesWithSeededDatabaseRoles() {
        Set<String> databaseRoleCodes = roleRepository.findAll().stream()
                .map(Role::getCode)
                .collect(Collectors.toSet());
        Set<String> javaRoleCodes = Arrays.stream(RoleCode.values())
                .map(RoleCode::getCode)
                .collect(Collectors.toSet());

        assertEquals(databaseRoleCodes, javaRoleCodes);
        for (RoleCode roleCode : RoleCode.values()) {
            assertNotNull(roleService.findByCode(roleCode));
        }
    }

    @Test
    void rejectsUnknownRoleCodeExplicitly() {
        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> roleService.findByCode("INCONNU")
        );

        assertEquals("Unknown role code INCONNU", exception.getMessage());
    }
}
