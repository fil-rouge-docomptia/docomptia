package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.DashboardAlertsResponse;
import org.facturation.backend.dto.response.DashboardPeriodResponse;
import org.facturation.backend.dto.response.DashboardStatusCountResponse;
import org.facturation.backend.dto.response.DashboardSummaryResponse;
import org.facturation.backend.dto.response.DashboardTotalsResponse;
import org.facturation.backend.dto.response.DashboardWorkQueuesResponse;
import org.facturation.backend.model.DuplicateAlertDecision;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.InvoiceDuplicateAlertRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.DashboardService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DashboardServiceImpl implements DashboardService {

    private final CurrentUserService currentUserService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceDuplicateAlertRepository duplicateAlertRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;

    public DashboardServiceImpl(
            CurrentUserService currentUserService,
            InvoiceRepository invoiceRepository,
            InvoiceDuplicateAlertRepository duplicateAlertRepository,
            AccountingEntryLineRepository accountingEntryLineRepository
    ) {
        this.currentUserService = currentUserService;
        this.invoiceRepository = invoiceRepository;
        this.duplicateAlertRepository = duplicateAlertRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary(LocalDate startDate, LocalDate endDate) {
        validatePeriod(startDate, endDate);
        Long organizationId = currentUserService.getCurrentUser().getOrganization().getOrganizationId();
        List<InvoiceRepository.DashboardStatusAggregate> aggregates =
                invoiceRepository.aggregateDashboardByStatus(organizationId, startDate, endDate);
        Map<String, Long> countsByStatus = aggregates.stream().collect(Collectors.toMap(
                InvoiceRepository.DashboardStatusAggregate::getStatus,
                InvoiceRepository.DashboardStatusAggregate::getInvoiceCount
        ));

        DashboardTotalsResponse totals = new DashboardTotalsResponse(
                aggregates.stream().mapToLong(InvoiceRepository.DashboardStatusAggregate::getInvoiceCount).sum(),
                sum(aggregates, InvoiceRepository.DashboardStatusAggregate::getTotalHt),
                sum(aggregates, InvoiceRepository.DashboardStatusAggregate::getTotalTva),
                sum(aggregates, InvoiceRepository.DashboardStatusAggregate::getTotalTtc)
        );
        DashboardWorkQueuesResponse workQueues = new DashboardWorkQueuesResponse(
                count(countsByStatus, InvoiceStatusCode.DEPOSEE),
                count(countsByStatus, InvoiceStatusCode.EXTRAITE),
                count(countsByStatus, InvoiceStatusCode.A_VERIFIER),
                count(countsByStatus, InvoiceStatusCode.EXPORTABLE)
        );
        DashboardAlertsResponse alerts = new DashboardAlertsResponse(
                count(countsByStatus, InvoiceStatusCode.ERREUR_OCR),
                duplicateAlertRepository.countDistinctInvoicesForDashboard(
                        organizationId, DuplicateAlertDecision.PENDING, startDate, endDate
                ),
                countUnbalancedEntries(organizationId, startDate, endDate)
        );
        List<DashboardStatusCountResponse> statusDistribution = aggregates.stream()
                .map(aggregate -> new DashboardStatusCountResponse(
                        aggregate.getStatus(), aggregate.getInvoiceCount()
                ))
                .toList();

        return new DashboardSummaryResponse(
                new DashboardPeriodResponse(startDate, endDate),
                totals,
                workQueues,
                alerts,
                statusDistribution
        );
    }

    private BigDecimal sum(
            List<InvoiceRepository.DashboardStatusAggregate> aggregates,
            java.util.function.Function<InvoiceRepository.DashboardStatusAggregate, BigDecimal> amount
    ) {
        return aggregates.stream().map(amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private long count(Map<String, Long> countsByStatus, InvoiceStatusCode status) {
        return countsByStatus.getOrDefault(status.getCode(), 0L);
    }

    private long countUnbalancedEntries(Long organizationId, LocalDate startDate, LocalDate endDate) {
        return accountingEntryLineRepository.findDashboardEntryBalances(organizationId, startDate, endDate).stream()
                .filter(balance -> balance.getTotalDebit().compareTo(balance.getTotalCredit()) != 0)
                .count();
    }

    private void validatePeriod(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate must be before or equal to endDate");
        }
    }
}
