package org.facturation.backend.dto.response;

public record UserListItemResponse(
        Long id,
        String firstName,
        String lastName,
        String email,
        CurrentUserRoleResponse role,
        boolean active
) {
}
