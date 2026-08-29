package org.facturation.backend.dto.response;

import java.util.List;

public record OnboardingStatusResponse(
        int progressPercentage,
        int completedStepCount,
        int totalStepCount,
        List<OnboardingStepResponse> completedSteps,
        List<OnboardingStepResponse> remainingActions
) {
}
