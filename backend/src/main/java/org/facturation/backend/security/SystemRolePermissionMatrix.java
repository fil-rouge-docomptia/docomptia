package org.facturation.backend.security;

import org.facturation.backend.model.RoleCode;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public final class SystemRolePermissionMatrix {

    private static final Set<BusinessPermission> READ_PERMISSIONS = EnumSet.of(
            BusinessPermission.USER_PROFILE_READ,
            BusinessPermission.REFERENCE_DATA_READ,
            BusinessPermission.ORGANIZATION_READ,
            BusinessPermission.DASHBOARD_READ,
            BusinessPermission.INVOICE_READ,
            BusinessPermission.SUPPLIER_READ,
            BusinessPermission.ACCOUNTING_CONFIGURATION_READ,
            BusinessPermission.CLASSIFICATION_READ
    );

    private static final Map<RoleCode, Set<BusinessPermission>> PERMISSIONS_BY_ROLE = buildMatrix();

    private SystemRolePermissionMatrix() {
    }

    public static Set<BusinessPermission> permissionsFor(RoleCode roleCode) {
        return Set.copyOf(PERMISSIONS_BY_ROLE.getOrDefault(roleCode, Set.of()));
    }

    public static Map<RoleCode, Set<BusinessPermission>> matrix() {
        return Map.copyOf(PERMISSIONS_BY_ROLE);
    }

    private static Map<RoleCode, Set<BusinessPermission>> buildMatrix() {
        Map<RoleCode, Set<BusinessPermission>> matrix = new EnumMap<>(RoleCode.class);
        matrix.put(RoleCode.OWNER, EnumSet.allOf(BusinessPermission.class));
        matrix.put(RoleCode.ADMIN, withoutOwnerManagement(EnumSet.allOf(BusinessPermission.class)));
        matrix.put(RoleCode.ACCOUNTING_MANAGER, accountingManagerPermissions());
        matrix.put(RoleCode.ACCOUNTANT, accountantPermissions());
        matrix.put(RoleCode.APPROVER, approverPermissions());
        matrix.put(RoleCode.VIEWER, EnumSet.copyOf(READ_PERMISSIONS));
        return matrix;
    }

    private static Set<BusinessPermission> withoutOwnerManagement(Set<BusinessPermission> permissions) {
        permissions.remove(BusinessPermission.MEMBER_OWNER_MANAGE);
        return permissions;
    }

    private static Set<BusinessPermission> accountingManagerPermissions() {
        Set<BusinessPermission> permissions = EnumSet.copyOf(READ_PERMISSIONS);
        permissions.add(BusinessPermission.INVOICE_APPROVE);
        permissions.add(BusinessPermission.INVOICE_ACCOUNTING_GENERATE);
        permissions.add(BusinessPermission.ACCOUNTING_ENTRY_UPDATE);
        return permissions;
    }

    private static Set<BusinessPermission> accountantPermissions() {
        Set<BusinessPermission> permissions = EnumSet.copyOf(READ_PERMISSIONS);
        permissions.add(BusinessPermission.INVOICE_UPLOAD);
        permissions.add(BusinessPermission.INVOICE_CORRECT);
        permissions.add(BusinessPermission.INVOICE_SUBMIT_FOR_VALIDATION);
        permissions.add(BusinessPermission.INVOICE_RETRY_OCR);
        permissions.add(BusinessPermission.INVOICE_REVIEW_DUPLICATE);
        permissions.add(BusinessPermission.INVOICE_ASSIGN);
        permissions.add(BusinessPermission.INVOICE_CLASSIFY);
        permissions.add(BusinessPermission.INVOICE_ACCOUNTING_GENERATE);
        permissions.add(BusinessPermission.ACCOUNTING_ENTRY_UPDATE);
        permissions.add(BusinessPermission.SUPPLIER_MANAGE);
        return permissions;
    }

    private static Set<BusinessPermission> approverPermissions() {
        Set<BusinessPermission> permissions = EnumSet.copyOf(READ_PERMISSIONS);
        permissions.add(BusinessPermission.INVOICE_APPROVE);
        return permissions;
    }
}
