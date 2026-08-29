package org.facturation.backend.service;

import org.facturation.backend.dto.response.OnboardingStatusResponse;

public interface OnboardingService {

    OnboardingStatusResponse getCurrentOrganizationStatus();
}
