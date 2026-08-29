package org.facturation.backend.service;

import org.facturation.backend.dto.request.OrganizationUpdateRequest;
import org.facturation.backend.dto.request.ValidationPreferencesUpdateRequest;
import org.facturation.backend.dto.response.OrganizationResponse;
import org.facturation.backend.dto.response.ValidationPreferencesResponse;
import org.facturation.backend.model.Organization;

import java.util.List;
import java.util.Optional;

public interface OrganizationService {

    List<Organization> findAll();

    Optional<Organization> findById(Long id);

    Organization save(Organization organization);

    OrganizationResponse findCurrentOrganization();

    OrganizationResponse updateCurrentOrganization(OrganizationUpdateRequest request);

    ValidationPreferencesResponse findCurrentValidationPreferences();

    ValidationPreferencesResponse updateCurrentValidationPreferences(ValidationPreferencesUpdateRequest request);
}
