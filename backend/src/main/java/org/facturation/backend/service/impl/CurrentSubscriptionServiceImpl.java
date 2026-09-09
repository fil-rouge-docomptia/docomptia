package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.CurrentSubscriptionResponse;
import org.facturation.backend.dto.response.SubscriptionPlanResponse;
import org.facturation.backend.dto.response.SubscriptionUsageResponse;
import org.facturation.backend.model.OrganizationSubscription;
import org.facturation.backend.model.SubscriptionPlan;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.model.SubscriptionPlanLimit;
import org.facturation.backend.repository.OrganizationSubscriptionRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.CurrentSubscriptionService;
import org.facturation.backend.service.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Service
public class CurrentSubscriptionServiceImpl implements CurrentSubscriptionService {

    private final OrganizationSubscriptionRepository subscriptionRepository;
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final InvoiceRepository invoiceRepository;

    public CurrentSubscriptionServiceImpl(
            OrganizationSubscriptionRepository subscriptionRepository,
            CurrentUserService currentUserService,
            UserRepository userRepository,
            InvoiceRepository invoiceRepository
    ) {
        this.subscriptionRepository = subscriptionRepository;
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.invoiceRepository = invoiceRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public CurrentSubscriptionResponse findCurrentSubscription() {
        Long organizationId = currentUserService.getCurrentUser().getOrganization().getOrganizationId();
        return subscriptionRepository.findCurrentAt(organizationId, LocalDate.now())
                .map(subscription -> toResponse(subscription, currentUsage(organizationId)))
                .orElseGet(CurrentSubscriptionResponse::withoutSubscription);
    }

    private SubscriptionUsageResponse currentUsage(Long organizationId) {
        YearMonth currentMonth = YearMonth.now();
        LocalDate periodStart = currentMonth.atDay(1);
        LocalDate nextPeriodStart = currentMonth.plusMonths(1).atDay(1);
        return new SubscriptionUsageResponse(
                periodStart,
                currentMonth.atEndOfMonth(),
                userRepository.countByOrganizationOrganizationIdAndIsActiveTrue(organizationId),
                invoiceRepository.countByOrganizationOrganizationIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        organizationId,
                        periodStart.atStartOfDay(),
                        nextPeriodStart.atStartOfDay()
                )
        );
    }

    private static CurrentSubscriptionResponse toResponse(
            OrganizationSubscription subscription,
            SubscriptionUsageResponse usage
    ) {
        SubscriptionPlan plan = subscription.getPlan();
        SubscriptionPlanLimit limits = plan.findLimitsAt(LocalDate.now())
                .orElseThrow(() -> new IllegalStateException("No current limits configured for plan " + plan.getCode()));
        SubscriptionPlanResponse planResponse = new SubscriptionPlanResponse(
                plan.getCode(),
                plan.getName(),
                limits.getMaxActiveUsers(),
                limits.getMonthlyInvoiceLimit(),
                List.copyOf(plan.getFeatures())
        );
        return new CurrentSubscriptionResponse(
                true,
                subscription.getStatus(),
                subscription.getNextBillingDate(),
                planResponse,
                usage
        );
    }
}
