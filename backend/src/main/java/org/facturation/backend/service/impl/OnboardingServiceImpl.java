package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.OnboardingStatusResponse;
import org.facturation.backend.dto.response.OnboardingStepResponse;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.OnboardingService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class OnboardingServiceImpl implements OnboardingService {

    private static final OnboardingStepResponse ORGANIZATION_INFORMATION = new OnboardingStepResponse(
            "ORGANIZATION_INFORMATION",
            "Complete organization information",
            "COMPLETE_ORGANIZATION_INFORMATION"
    );
    private static final OnboardingStepResponse ACCOUNTING_PREFERENCES = new OnboardingStepResponse(
            "ACCOUNTING_PREFERENCES",
            "Configure accounting preferences",
            "CONFIGURE_ACCOUNTING_PREFERENCES"
    );
    private static final OnboardingStepResponse CHART_OF_ACCOUNTS = new OnboardingStepResponse(
            "CHART_OF_ACCOUNTS",
            "Configure the chart of accounts",
            "CONFIGURE_CHART_OF_ACCOUNTS"
    );
    private static final int TOTAL_STEP_COUNT = 3;

    private final CurrentUserService currentUserService;
    private final ChartOfAccountRepository chartOfAccountRepository;

    public OnboardingServiceImpl(
            CurrentUserService currentUserService,
            ChartOfAccountRepository chartOfAccountRepository
    ) {
        this.currentUserService = currentUserService;
        this.chartOfAccountRepository = chartOfAccountRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public OnboardingStatusResponse getCurrentOrganizationStatus() {
        Organization organization = currentUserService.getCurrentUser().getOrganization();
        List<OnboardingStepResponse> completedSteps = new ArrayList<>();
        List<OnboardingStepResponse> remainingActions = new ArrayList<>();

        addStep(ORGANIZATION_INFORMATION, hasCompleteOrganizationInformation(organization),
                completedSteps, remainingActions);
        addStep(ACCOUNTING_PREFERENCES, hasAccountingPreferences(organization),
                completedSteps, remainingActions);
        addStep(CHART_OF_ACCOUNTS, hasActiveAccount(organization), completedSteps, remainingActions);

        int progressPercentage = (int) Math.round(completedSteps.size() * 100.0 / TOTAL_STEP_COUNT);
        return new OnboardingStatusResponse(
                progressPercentage,
                completedSteps.size(),
                TOTAL_STEP_COUNT,
                List.copyOf(completedSteps),
                List.copyOf(remainingActions)
        );
    }

    private void addStep(
            OnboardingStepResponse step,
            boolean completed,
            List<OnboardingStepResponse> completedSteps,
            List<OnboardingStepResponse> remainingActions
    ) {
        (completed ? completedSteps : remainingActions).add(step);
    }

    private boolean hasCompleteOrganizationInformation(Organization organization) {
        return hasText(organization.getName())
                && hasText(organization.getLegalName())
                && hasText(organization.getSiret())
                && hasText(organization.getEmail())
                && hasText(organization.getAddress());
    }

    private boolean hasAccountingPreferences(Organization organization) {
        return hasText(organization.getDefaultCurrencyCode());
    }

    private boolean hasActiveAccount(Organization organization) {
        return chartOfAccountRepository.existsByOrganizationOrganizationIdAndIsActiveTrue(
                organization.getOrganizationId()
        );
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
