package org.facturation.backend.service;

import org.facturation.backend.exception.SubscriptionLimitExceededException;
import org.facturation.backend.model.SubscriptionPlanLimit;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.OrganizationSubscriptionRepository;
import org.facturation.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.function.Function;
import java.util.function.ToLongFunction;

@Service
public class SubscriptionQuotaService {

    public static final String MAX_ACTIVE_USERS = "MAX_ACTIVE_USERS";
    public static final String MONTHLY_INVOICE_LIMIT = "MONTHLY_INVOICE_LIMIT";

    private final OrganizationSubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final InvoiceRepository invoiceRepository;

    public SubscriptionQuotaService(
            OrganizationSubscriptionRepository subscriptionRepository,
            UserRepository userRepository,
            InvoiceRepository invoiceRepository
    ) {
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
        this.invoiceRepository = invoiceRepository;
    }

    @Transactional(readOnly = true)
    public void ensureUserCanBeActivated(Long organizationId) {
        ensureBelowLimit(
                organizationId,
                MAX_ACTIVE_USERS,
                SubscriptionPlanLimit::getMaxActiveUsers,
                userRepository::countByOrganizationOrganizationIdAndIsActiveTrue
        );
    }

    @Transactional(readOnly = true)
    public void ensureInvoiceCanBeCreated(Long organizationId) {
        YearMonth currentMonth = YearMonth.now();
        ensureBelowLimit(
                organizationId,
                MONTHLY_INVOICE_LIMIT,
                SubscriptionPlanLimit::getMonthlyInvoiceLimit,
                id -> invoiceRepository.countByOrganizationOrganizationIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        id,
                        currentMonth.atDay(1).atStartOfDay(),
                        currentMonth.plusMonths(1).atDay(1).atStartOfDay()
                )
        );
    }

    private void ensureBelowLimit(
            Long organizationId,
            String limitName,
            Function<SubscriptionPlanLimit, Integer> quotaExtractor,
            ToLongFunction<Long> usageCounter
    ) {
        subscriptionRepository.findByOrganizationOrganizationId(organizationId).ifPresent(subscription -> {
            SubscriptionPlanLimit limits = subscription.getPlan().findLimitsAt(LocalDate.now())
                    .orElseThrow(() -> new IllegalStateException(
                            "No current limits configured for plan " + subscription.getPlan().getCode()
                    ));
            Integer quota = quotaExtractor.apply(limits);
            if (quota == null) {
                return;
            }

            long usage = usageCounter.applyAsLong(organizationId);
            if (usage >= quota) {
                throw new SubscriptionLimitExceededException(limitName, quota, usage);
            }
        });
    }
}
