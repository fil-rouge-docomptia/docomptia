package org.facturation.backend.security;

import org.facturation.backend.model.User;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.stream.Stream;

public final class RbacAuthorities {

    private RbacAuthorities() {
    }

    public static SimpleGrantedAuthority[] from(User user) {
        return Stream.concat(Stream.of(user.getRole()), user.getRoles().stream())
                .distinct()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> new SimpleGrantedAuthority("PERMISSION_" + permission.getCode()))
                .distinct()
                .toArray(SimpleGrantedAuthority[]::new);
    }
}
