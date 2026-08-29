package org.facturation.backend.dto.response;

public record OrganizationResponse(
        Long organizationId,
        String name,
        String legalName,
        String siret,
        String email,
        String phone,
        String address,
        String defaultCurrencyCode
) {
}
