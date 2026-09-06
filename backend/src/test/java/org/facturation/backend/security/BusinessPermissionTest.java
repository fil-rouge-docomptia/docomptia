package org.facturation.backend.security;

import org.facturation.backend.model.Permission;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.model.User;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class BusinessPermissionTest {

    @Test
    void definesAtomicPermissionCodes() {
        Set<String> permissionCodes = Arrays.stream(BusinessPermission.values())
                .map(BusinessPermission::getCode)
                .collect(Collectors.toSet());

        assertThat(permissionCodes)
                .contains(
                        "invoice.read",
                        "invoice.approve",
                        "invoice.upload",
                        "member.invite",
                        "member.role.update",
                        "member.owner.manage"
                );
        assertThat(permissionCodes)
                .allMatch(code -> code.contains("."))
                .allMatch(code -> code.equals(code.toLowerCase(Locale.ROOT)));
    }

    @Test
    void definesTheSystemRolePermissionMatrix() {
        assertThat(SystemRolePermissionMatrix.permissionsFor(RoleCode.OWNER))
                .containsExactlyInAnyOrder(BusinessPermission.values());
        assertThat(SystemRolePermissionMatrix.permissionsFor(RoleCode.ADMIN))
                .contains(BusinessPermission.MEMBER_INVITE, BusinessPermission.INVOICE_APPROVE)
                .doesNotContain(BusinessPermission.MEMBER_OWNER_MANAGE);
        assertThat(SystemRolePermissionMatrix.permissionsFor(RoleCode.ACCOUNTANT))
                .contains(BusinessPermission.INVOICE_UPLOAD, BusinessPermission.INVOICE_CORRECT)
                .doesNotContain(BusinessPermission.INVOICE_APPROVE);
        assertThat(SystemRolePermissionMatrix.permissionsFor(RoleCode.APPROVER))
                .contains(BusinessPermission.INVOICE_APPROVE)
                .doesNotContain(BusinessPermission.INVOICE_UPLOAD);
        assertThat(SystemRolePermissionMatrix.permissionsFor(RoleCode.VIEWER))
                .contains(BusinessPermission.INVOICE_READ)
                .doesNotContain(BusinessPermission.INVOICE_UPLOAD);
    }

    @Test
    void exposesPermissionAuthoritiesExpectedBySpringSecurity() {
        assertThat(BusinessPermission.INVOICE_APPROVE.authority())
                .isEqualTo("PERMISSION_invoice.approve");
    }

    @Test
    void effectivePermissionsAreTheUnionOfAssignedRoles() {
        Role accountant = role(RoleCode.ACCOUNTANT, BusinessPermission.INVOICE_UPLOAD);
        Role approver = role(RoleCode.APPROVER, BusinessPermission.INVOICE_APPROVE);
        User user = new User();
        user.setRoles(new LinkedHashSet<>(List.of(accountant, approver)));

        assertThat(PermissionAuthority.permissionCodes(user))
                .containsExactlyInAnyOrder("invoice.upload", "invoice.approve");
        assertThat(PermissionAuthority.authorities(user))
                .extracting(authority -> authority.getAuthority())
                .containsExactlyInAnyOrder("PERMISSION_invoice.upload", "PERMISSION_invoice.approve");
    }

    private Role role(RoleCode roleCode, BusinessPermission permission) {
        Role role = new Role();
        role.setCode(roleCode.getCode());
        role.setPermissions(Set.of(permission(permission)));
        return role;
    }

    private Permission permission(BusinessPermission businessPermission) {
        Permission permission = new Permission();
        permission.setCode(businessPermission.getCode());
        permission.setLabel(businessPermission.getLabel());
        return permission;
    }
}
