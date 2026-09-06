package org.facturation.backend.security;

import org.facturation.backend.model.RoleCode;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class BusinessPermissionTest {

    private static final Set<RoleCode> ALL_ROLES = Set.of(
            RoleCode.ADMIN,
            RoleCode.OPERATEUR_COMPTABLE,
            RoleCode.RESPONSABLE_COMPTABLE
    );

    @Test
    void definesTheMvpPermissionMatrix() {
        assertThat(BusinessPermission.VIEW_OWN_PROFILE.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.VIEW_REFERENCE_DATA.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.VIEW_ORGANIZATION.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.MANAGE_ORGANIZATION.getRoles()).containsExactly(RoleCode.ADMIN);
        assertThat(BusinessPermission.VIEW_INVOICES.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.COMMENT_INVOICES.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.VIEW_DASHBOARD.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.PROCESS_INVOICES.getRoles())
                .containsExactlyInAnyOrder(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE);
        assertThat(BusinessPermission.VALIDATE_INVOICES.getRoles())
                .containsExactly(RoleCode.RESPONSABLE_COMPTABLE);
        assertThat(BusinessPermission.MANAGE_ACCOUNTING_ENTRIES.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.VIEW_SUPPLIERS.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.MANAGE_SUPPLIERS.getRoles())
                .containsExactlyInAnyOrder(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE);
        assertThat(BusinessPermission.VIEW_ACCOUNTING_CONFIGURATION.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.MANAGE_ACCOUNTING_CONFIGURATION.getRoles())
                .containsExactly(RoleCode.ADMIN);
        assertThat(BusinessPermission.VIEW_CLASSIFICATIONS.getRoles()).isEqualTo(ALL_ROLES);
        assertThat(BusinessPermission.MANAGE_CLASSIFICATIONS.getRoles()).containsExactly(RoleCode.ADMIN);
        assertThat(BusinessPermission.MANAGE_USERS.getRoles()).containsExactly(RoleCode.ADMIN);
    }

    @Test
    void exposesRoleCodesExpectedBySpringSecurity() {
        assertThat(BusinessPermission.VALIDATE_INVOICES.roleCodes())
                .containsExactly("RESPONSABLE_COMPTABLE");
    }
}
