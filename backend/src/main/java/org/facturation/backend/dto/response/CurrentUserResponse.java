package org.facturation.backend.dto.response;

public record CurrentUserResponse(
        Long id,
        String firstName,
        String lastName,
        String email,
        CurrentUserRoleResponse role,
        CurrentUserOrganizationResponse organization
) {
}
