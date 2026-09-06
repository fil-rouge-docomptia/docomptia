package org.facturation.backend.security;

import org.facturation.backend.model.Permission;
import org.facturation.backend.model.User;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public final class PermissionAuthority {

    private static final String PREFIX = "PERMISSION_";

    private PermissionAuthority() {
    }

    public static String name(BusinessPermission permission) {
        return PREFIX + permission.getCode();
    }

    public static SimpleGrantedAuthority grantedAuthority(String permissionCode) {
        return new SimpleGrantedAuthority(PREFIX + permissionCode);
    }

    public static List<SimpleGrantedAuthority> authorities(User user) {
        return permissionCodes(user).stream()
                .sorted()
                .map(PermissionAuthority::grantedAuthority)
                .toList();
    }

    public static Set<String> permissionCodes(User user) {
        return user.getEffectiveRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getCode)
                .collect(Collectors.toUnmodifiableSet());
    }

    public static boolean hasPermission(User user, BusinessPermission permission) {
        return permissionCodes(user).contains(permission.getCode());
    }
}
