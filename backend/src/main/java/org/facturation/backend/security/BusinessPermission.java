package org.facturation.backend.security;

import org.facturation.backend.model.RoleCode;

import java.util.EnumSet;
import java.util.Set;

public enum BusinessPermission {
    VIEW_OWN_PROFILE(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE, RoleCode.RESPONSABLE_COMPTABLE),
    VIEW_INVOICES(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE, RoleCode.RESPONSABLE_COMPTABLE),
    PROCESS_INVOICES(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE),
    VALIDATE_INVOICES(RoleCode.ADMIN, RoleCode.RESPONSABLE_COMPTABLE),
    MANAGE_ACCOUNTING_ENTRIES(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE, RoleCode.RESPONSABLE_COMPTABLE),
    VIEW_SUPPLIERS(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE, RoleCode.RESPONSABLE_COMPTABLE),
    MANAGE_SUPPLIERS(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE),
    VIEW_ACCOUNTING_CONFIGURATION(RoleCode.ADMIN, RoleCode.OPERATEUR_COMPTABLE, RoleCode.RESPONSABLE_COMPTABLE),
    MANAGE_ACCOUNTING_CONFIGURATION(RoleCode.ADMIN);

    private final Set<RoleCode> roles;

    BusinessPermission(RoleCode firstRole, RoleCode... otherRoles) {
        this.roles = EnumSet.of(firstRole, otherRoles);
    }

    public Set<RoleCode> getRoles() {
        return Set.copyOf(roles);
    }

    public String[] roleCodes() {
        return roles.stream()
                .map(RoleCode::getCode)
                .toArray(String[]::new);
    }
}
