package org.facturation.backend.dto.response;

import java.util.List;

public record UserListItemResponse(
        Long id,
        String firstName,
        String lastName,
        String email,
        CurrentUserRoleResponse role,
        List<CurrentUserRoleResponse> roles,
        boolean active
) {
}
