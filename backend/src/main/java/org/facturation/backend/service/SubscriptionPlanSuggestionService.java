package org.facturation.backend.service;

import org.facturation.backend.dto.response.SubscriptionLimitDifferenceResponse;
import org.facturation.backend.dto.response.SubscriptionPlanResponse;
import org.facturation.backend.dto.response.SubscriptionPlanSuggestionResponse;
import org.facturation.backend.model.SubscriptionPlan;
import org.facturation.backend.model.SubscriptionPlanLimit;
import org.facturation.backend.repository.SubscriptionPlanRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class SubscriptionPlanSuggestionService {

    private final SubscriptionPlanRepository planRepository;

    public SubscriptionPlanSuggestionService(SubscriptionPlanRepository planRepository) {
        this.planRepository = planRepository;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlanSuggestionResponse> findCompatiblePlans(
            SubscriptionPlan currentPlan,
            SubscriptionPlanLimit currentLimits,
            String reachedLimit,
            long usage
    ) {
        return planRepository.findByActiveTrueOrderBySubscriptionPlanId().stream()
                .filter(plan -> !plan.getSubscriptionPlanId().equals(currentPlan.getSubscriptionPlanId()))
                .filter(plan -> plan.getFeatures().containsAll(currentPlan.getFeatures()))
                .map(plan -> toSuggestion(plan, currentPlan, currentLimits, reachedLimit, usage))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<SubscriptionPlanSuggestionResponse> toSuggestion(
            SubscriptionPlan plan,
            SubscriptionPlan currentPlan,
            SubscriptionPlanLimit currentLimits,
            String reachedLimit,
            long usage
    ) {
        SubscriptionPlanLimit suggestedLimits = plan.findLimitsAt(LocalDate.now())
                .orElseThrow(() -> new IllegalStateException("No current limits configured for plan " + plan.getCode()));
        if (!isAtLeast(currentLimits.getMaxActiveUsers(), suggestedLimits.getMaxActiveUsers())
                || !isAtLeast(currentLimits.getMonthlyInvoiceLimit(), suggestedLimits.getMonthlyInvoiceLimit())
                || !supportsNextAction(suggestedLimits, reachedLimit, usage)) {
            return Optional.empty();
        }

        List<SubscriptionLimitDifferenceResponse> differences = new ArrayList<>();
        addDifference(differences, SubscriptionQuotaService.MAX_ACTIVE_USERS,
                currentLimits.getMaxActiveUsers(), suggestedLimits.getMaxActiveUsers());
        addDifference(differences, SubscriptionQuotaService.MONTHLY_INVOICE_LIMIT,
                currentLimits.getMonthlyInvoiceLimit(), suggestedLimits.getMonthlyInvoiceLimit());
        List<String> addedFeatures = plan.getFeatures().stream()
                .filter(feature -> !currentPlan.getFeatures().contains(feature))
                .toList();
        return Optional.of(new SubscriptionPlanSuggestionResponse(
                new SubscriptionPlanResponse(
                        plan.getCode(),
                        plan.getName(),
                        suggestedLimits.getMaxActiveUsers(),
                        suggestedLimits.getMonthlyInvoiceLimit(),
                        List.copyOf(plan.getFeatures())
                ),
                List.copyOf(differences),
                addedFeatures
        ));
    }

    private static boolean isAtLeast(Integer currentValue, Integer suggestedValue) {
        if (currentValue == null) {
            return suggestedValue == null;
        }
        return suggestedValue == null || suggestedValue >= currentValue;
    }

    private static boolean supportsNextAction(SubscriptionPlanLimit limits, String reachedLimit, long usage) {
        Integer suggestedQuota = switch (reachedLimit) {
            case SubscriptionQuotaService.MAX_ACTIVE_USERS -> limits.getMaxActiveUsers();
            case SubscriptionQuotaService.MONTHLY_INVOICE_LIMIT -> limits.getMonthlyInvoiceLimit();
            default -> throw new IllegalArgumentException("Unknown subscription limit " + reachedLimit);
        };
        return suggestedQuota == null || usage < suggestedQuota;
    }

    private static void addDifference(
            List<SubscriptionLimitDifferenceResponse> differences,
            String limit,
            Integer currentValue,
            Integer suggestedValue
    ) {
        if (!Objects.equals(currentValue, suggestedValue)) {
            differences.add(new SubscriptionLimitDifferenceResponse(limit, currentValue, suggestedValue));
        }
    }
}
