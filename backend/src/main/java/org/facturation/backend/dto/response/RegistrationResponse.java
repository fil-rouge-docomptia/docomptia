package org.facturation.backend.dto.response;

public record RegistrationResponse(
        Long organizationId,
        Long userId,
        String email,
        String role
) {
}
