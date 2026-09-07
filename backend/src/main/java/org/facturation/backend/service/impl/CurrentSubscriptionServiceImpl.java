package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.CurrentSubscriptionResponse;
import org.facturation.backend.dto.response.SubscriptionPlanResponse;
import org.facturation.backend.model.OrganizationSubscription;
import org.facturation.backend.model.SubscriptionPlan;
import org.facturation.backend.repository.OrganizationSubscriptionRepository;
import org.facturation.backend.service.CurrentSubscriptionService;
import org.facturation.backend.service.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CurrentSubscriptionServiceImpl implements CurrentSubscriptionService {

    private final OrganizationSubscriptionRepository subscriptionRepository;
    private final CurrentUserService currentUserService;

    public CurrentSubscriptionServiceImpl(
            OrganizationSubscriptionRepository subscriptionRepository,
            CurrentUserService currentUserService
    ) {
        this.subscriptionRepository = subscriptionRepository;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional(readOnly = true)
    public CurrentSubscriptionResponse findCurrentSubscription() {
        Long organizationId = currentUserService.getCurrentUser().getOrganization().getOrganizationId();
        return subscriptionRepository
                .findFirstByOrganizationOrganizationIdAndEndDateIsNullOrderByStartDateDescOrganizationSubscriptionIdDesc(
                        organizationId
                )
                .map(CurrentSubscriptionServiceImpl::toResponse)
                .orElseGet(CurrentSubscriptionResponse::withoutSubscription);
    }

    private static CurrentSubscriptionResponse toResponse(OrganizationSubscription subscription) {
        SubscriptionPlan plan = subscription.getPlan();
        SubscriptionPlanResponse planResponse = new SubscriptionPlanResponse(
                plan.getCode(),
                plan.getName(),
                plan.getMaxActiveUsers(),
                plan.getMonthlyInvoiceLimit(),
                List.copyOf(plan.getFeatures())
        );
        return new CurrentSubscriptionResponse(
                true,
                subscription.getStatus(),
                subscription.getNextBillingDate(),
                planResponse
        );
    }
}
