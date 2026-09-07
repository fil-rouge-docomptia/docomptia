package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.SubscriptionPlanChangeRequest;
import org.facturation.backend.dto.response.SubscriptionPlanChangeResponse;
import org.facturation.backend.dto.response.SubscriptionPlanResponse;
import org.facturation.backend.exception.InvalidSubscriptionChangeException;
import org.facturation.backend.exception.SubscriptionChangeConflictException;
import org.facturation.backend.model.OrganizationSubscription;
import org.facturation.backend.model.SubscriptionPlan;
import org.facturation.backend.model.SubscriptionPlanLimit;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.OrganizationSubscriptionRepository;
import org.facturation.backend.repository.SubscriptionPlanRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.SubscriptionPlanChangeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Service
public class SubscriptionPlanChangeServiceImpl implements SubscriptionPlanChangeService {

    private static final String UPGRADE = "UPGRADE";
    private static final String DOWNGRADE = "DOWNGRADE";

    private final CurrentUserService currentUserService;
    private final OrganizationSubscriptionRepository subscriptionRepository;
    private final SubscriptionPlanRepository planRepository;
    private final UserRepository userRepository;
    private final InvoiceRepository invoiceRepository;

    public SubscriptionPlanChangeServiceImpl(
            CurrentUserService currentUserService,
            OrganizationSubscriptionRepository subscriptionRepository,
            SubscriptionPlanRepository planRepository,
            UserRepository userRepository,
            InvoiceRepository invoiceRepository
    ) {
        this.currentUserService = currentUserService;
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository = planRepository;
        this.userRepository = userRepository;
        this.invoiceRepository = invoiceRepository;
    }

    @Override
    @Transactional
    public SubscriptionPlanChangeResponse changeCurrentPlan(SubscriptionPlanChangeRequest request) {
        String requestedCode = normalizePlanCode(request);
        User user = currentUserService.getCurrentUser();
        Long organizationId = user.getOrganization().getOrganizationId();
        LocalDate today = LocalDate.now();
        OrganizationSubscription current = subscriptionRepository.findCurrentAt(organizationId, today)
                .orElseThrow(() -> new InvalidSubscriptionChangeException(
                        "The organization has no current subscription"
                ));
        if (subscriptionRepository.existsByOrganizationOrganizationIdAndStartDateGreaterThan(organizationId, today)) {
            throw new SubscriptionChangeConflictException("A subscription change is already scheduled");
        }

        SubscriptionPlan targetPlan = planRepository.findByCodeIgnoreCaseAndActiveTrue(requestedCode)
                .orElseThrow(() -> new InvalidSubscriptionChangeException("Unknown or inactive subscription plan"));
        if (targetPlan.getSubscriptionPlanId().equals(current.getPlan().getSubscriptionPlanId())) {
            throw new InvalidSubscriptionChangeException("The requested plan is already active");
        }

        SubscriptionPlanLimit currentLimits = limitsAt(current.getPlan(), today);
        boolean upgrade = isUpgrade(current.getPlan(), currentLimits, targetPlan, today);
        LocalDate effectiveDate = upgrade ? today : downgradeEffectiveDate(current, today);
        SubscriptionPlanLimit targetLimits = limitsAt(targetPlan, effectiveDate);
        if (!upgrade) {
            ensureDowngradeSupportsCurrentUsage(organizationId, targetLimits);
        }

        current.setEndDate(effectiveDate.minusDays(1));
        OrganizationSubscription changedSubscription = new OrganizationSubscription();
        changedSubscription.setOrganization(current.getOrganization());
        changedSubscription.setPlan(targetPlan);
        changedSubscription.setStatus(current.getStatus());
        changedSubscription.setStartDate(effectiveDate);
        changedSubscription.setNextBillingDate(upgrade
                ? current.getNextBillingDate()
                : effectiveDate.plusMonths(1));
        subscriptionRepository.saveAndFlush(current);
        subscriptionRepository.save(changedSubscription);

        return new SubscriptionPlanChangeResponse(
                upgrade ? UPGRADE : DOWNGRADE,
                effectiveDate,
                toPlanResponse(targetPlan, targetLimits)
        );
    }

    private static String normalizePlanCode(SubscriptionPlanChangeRequest request) {
        if (request == null || request.planCode() == null || request.planCode().isBlank()) {
            throw new InvalidSubscriptionChangeException("The plan code is required");
        }
        return request.planCode().trim();
    }

    private static boolean isUpgrade(
            SubscriptionPlan currentPlan,
            SubscriptionPlanLimit currentLimits,
            SubscriptionPlan targetPlan,
            LocalDate date
    ) {
        SubscriptionPlanLimit targetLimits = limitsAt(targetPlan, date);
        return targetPlan.getFeatures().containsAll(currentPlan.getFeatures())
                && isAtLeast(currentLimits.getMaxActiveUsers(), targetLimits.getMaxActiveUsers())
                && isAtLeast(currentLimits.getMonthlyInvoiceLimit(), targetLimits.getMonthlyInvoiceLimit());
    }

    private static boolean isAtLeast(Integer currentLimit, Integer targetLimit) {
        if (currentLimit == null) {
            return targetLimit == null;
        }
        return targetLimit == null || targetLimit >= currentLimit;
    }

    private static LocalDate downgradeEffectiveDate(OrganizationSubscription current, LocalDate today) {
        LocalDate nextBillingDate = current.getNextBillingDate();
        if (nextBillingDate == null || !nextBillingDate.isAfter(today)) {
            throw new InvalidSubscriptionChangeException(
                    "A future billing date is required to schedule a downgrade"
            );
        }
        return nextBillingDate;
    }

    private void ensureDowngradeSupportsCurrentUsage(Long organizationId, SubscriptionPlanLimit targetLimits) {
        long activeUsers = userRepository.countByOrganizationOrganizationIdAndIsActiveTrue(organizationId);
        ensureWithinLimit("active users", activeUsers, targetLimits.getMaxActiveUsers());

        YearMonth currentMonth = YearMonth.now();
        long monthlyInvoices = invoiceRepository
                .countByOrganizationOrganizationIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        organizationId,
                        currentMonth.atDay(1).atStartOfDay(),
                        currentMonth.plusMonths(1).atDay(1).atStartOfDay()
                );
        ensureWithinLimit("monthly invoices", monthlyInvoices, targetLimits.getMonthlyInvoiceLimit());
    }

    private static void ensureWithinLimit(String name, long usage, Integer limit) {
        if (limit != null && usage > limit) {
            throw new SubscriptionChangeConflictException(
                    "The downgrade limit for " + name + " is " + limit + ", current usage is " + usage
            );
        }
    }

    private static SubscriptionPlanLimit limitsAt(SubscriptionPlan plan, LocalDate date) {
        return plan.findLimitsAt(date)
                .orElseThrow(() -> new IllegalStateException("No limits configured for plan " + plan.getCode()));
    }

    private static SubscriptionPlanResponse toPlanResponse(SubscriptionPlan plan, SubscriptionPlanLimit limits) {
        return new SubscriptionPlanResponse(
                plan.getCode(),
                plan.getName(),
                limits.getMaxActiveUsers(),
                limits.getMonthlyInvoiceLimit(),
                List.copyOf(plan.getFeatures())
        );
    }
}
