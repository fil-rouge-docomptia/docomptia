package org.facturation.backend.dto.response;

import java.util.List;
import java.util.Set;

public record CurrentUserResponse(
        Long id,
        String firstName,
        String lastName,
        String email,
        CurrentUserRoleResponse role,
        List<CurrentUserRoleResponse> roles,
        Set<String> permissions,
        CurrentUserOrganizationResponse organization
) {
}
