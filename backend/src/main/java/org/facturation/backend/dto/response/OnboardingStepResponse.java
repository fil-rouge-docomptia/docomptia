package org.facturation.backend.dto.response;

public record OnboardingStepResponse(
        String code,
        String label,
        String action
) {
}
