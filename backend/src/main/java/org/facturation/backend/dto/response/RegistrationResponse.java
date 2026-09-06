package org.facturation.backend.dto.response;

import java.util.List;
import java.util.Set;

public record RegistrationResponse(
        Long organizationId,
        Long userId,
        String email,
        String role,
        List<CurrentUserRoleResponse> roles,
        Set<String> permissions
) {
}
