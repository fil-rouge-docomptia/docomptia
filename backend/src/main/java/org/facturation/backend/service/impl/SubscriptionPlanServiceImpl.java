package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.SubscriptionPlanResponse;
import org.facturation.backend.model.SubscriptionPlan;
import org.facturation.backend.repository.SubscriptionPlanRepository;
import org.facturation.backend.service.SubscriptionPlanService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SubscriptionPlanServiceImpl implements SubscriptionPlanService {

    private final SubscriptionPlanRepository subscriptionPlanRepository;

    public SubscriptionPlanServiceImpl(SubscriptionPlanRepository subscriptionPlanRepository) {
        this.subscriptionPlanRepository = subscriptionPlanRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponse> findActivePlans() {
        return subscriptionPlanRepository.findByActiveTrueOrderBySubscriptionPlanId().stream()
                .map(SubscriptionPlanServiceImpl::toResponse)
                .toList();
    }

    private static SubscriptionPlanResponse toResponse(SubscriptionPlan plan) {
        return new SubscriptionPlanResponse(
                plan.getCode(),
                plan.getName(),
                plan.getMaxActiveUsers(),
                plan.getMonthlyInvoiceLimit(),
                List.copyOf(plan.getFeatures())
        );
    }
}
