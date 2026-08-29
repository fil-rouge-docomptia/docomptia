package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.OrganizationResponse;
import org.facturation.backend.model.Organization;
import org.springframework.stereotype.Component;

@Component
public class OrganizationResponseMapper {

    public OrganizationResponse toResponse(Organization organization) {
        return new OrganizationResponse(
                organization.getOrganizationId(),
                organization.getName(),
                organization.getLegalName(),
                organization.getSiret(),
                organization.getEmail(),
                organization.getPhone(),
                organization.getAddress(),
                organization.getDefaultCurrencyCode()
        );
    }
}
