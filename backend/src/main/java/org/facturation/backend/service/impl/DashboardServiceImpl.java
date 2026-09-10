package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.DashboardActionRequiredInvoiceResponse;
import org.facturation.backend.dto.response.DashboardAlertsResponse;
import org.facturation.backend.dto.response.DashboardPeriodResponse;
import org.facturation.backend.dto.response.DashboardStatusCountResponse;
import org.facturation.backend.dto.response.DashboardSummaryResponse;
import org.facturation.backend.dto.response.DashboardTotalsResponse;
import org.facturation.backend.dto.response.DashboardWorkQueuesResponse;
import org.facturation.backend.model.DuplicateAlertDecision;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.InvoiceDuplicateAlertRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.DashboardService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class DashboardServiceImpl implements DashboardService {

    private static final int MAX_ACTION_INVOICE_LIMIT = 100;
    private static final Set<InvoiceStatusCode> ACTION_REQUIRED_STATUSES = Set.of(
            InvoiceStatusCode.ERREUR_OCR,
            InvoiceStatusCode.ERREUR_TRAITEMENT,
            InvoiceStatusCode.EXTRAITE,
            InvoiceStatusCode.A_VERIFIER,
            InvoiceStatusCode.REJETEE
    );

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
    public DashboardSummaryResponse getSummary(LocalDate startDate, LocalDate endDate, int actionLimit) {
        validatePeriod(startDate, endDate);
        validateActionLimit(actionLimit);
        Long organizationId = currentUserService.getCurrentUser().getOrganization().getOrganizationId();
        boolean hasStartDate = startDate != null;
        boolean hasEndDate = endDate != null;
        List<InvoiceRepository.DashboardStatusAggregate> aggregates =
                invoiceRepository.aggregateDashboardByStatus(
                        organizationId, hasStartDate, startDate, hasEndDate, endDate
                );
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
                count(countsByStatus, InvoiceStatusCode.ERREUR_OCR)
                        + count(countsByStatus, InvoiceStatusCode.ERREUR_TRAITEMENT),
                duplicateAlertRepository.countDistinctInvoicesForDashboard(
                        organizationId,
                        DuplicateAlertDecision.PENDING,
                        hasStartDate,
                        startDate,
                        hasEndDate,
                        endDate
                ),
                countUnbalancedEntries(organizationId, hasStartDate, startDate, hasEndDate, endDate)
        );
        List<DashboardStatusCountResponse> statusDistribution = Arrays.stream(InvoiceStatusCode.values())
                .sorted(Comparator.comparing(InvoiceStatusCode::getCode))
                .map(status -> new DashboardStatusCountResponse(
                        status.getCode(), count(countsByStatus, status)
                ))
                .toList();
        List<DashboardActionRequiredInvoiceResponse> actionRequiredInvoices = findActionRequiredInvoices(
                organizationId, startDate, endDate, actionLimit
        );

        return new DashboardSummaryResponse(
                new DashboardPeriodResponse(startDate, endDate),
                totals,
                workQueues,
                alerts,
                statusDistribution,
                actionRequiredInvoices
        );
    }

    private List<DashboardActionRequiredInvoiceResponse> findActionRequiredInvoices(
            Long organizationId,
            LocalDate startDate,
            LocalDate endDate,
            int actionLimit
    ) {
        Specification<Invoice> specification = (root, query, criteriaBuilder) -> criteriaBuilder.and(
                criteriaBuilder.equal(root.get("organization").get("organizationId"), organizationId),
                root.get("invoiceStatus").get("code").in(ACTION_REQUIRED_STATUSES.stream()
                        .map(InvoiceStatusCode::getCode)
                        .toList()),
                startDate == null
                        ? criteriaBuilder.conjunction()
                        : criteriaBuilder.greaterThanOrEqualTo(root.get("invoiceDate"), startDate),
                endDate == null
                        ? criteriaBuilder.conjunction()
                        : criteriaBuilder.lessThanOrEqualTo(root.get("invoiceDate"), endDate)
        );
        PageRequest pageRequest = PageRequest.of(
                0,
                actionLimit,
                Sort.by(Sort.Direction.DESC, "updatedAt").and(Sort.by(Sort.Direction.DESC, "invoiceId"))
        );

        return invoiceRepository.findAll(specification, pageRequest).stream()
                .map(this::toActionRequiredInvoiceResponse)
                .toList();
    }

    private DashboardActionRequiredInvoiceResponse toActionRequiredInvoiceResponse(Invoice invoice) {
        InvoiceStatusCode status = InvoiceStatusCode.fromCode(invoice.getInvoiceStatus().getCode());
        return new DashboardActionRequiredInvoiceResponse(
                invoice.getInvoiceId(),
                invoice.getInvoiceNumber(),
                invoice.getInvoiceDate(),
                invoice.getSupplier() == null ? null : invoice.getSupplier().getName(),
                invoice.getTotalTtc(),
                invoice.getCurrencyCode(),
                status.getCode(),
                requiredAction(status)
        );
    }

    private String requiredAction(InvoiceStatusCode status) {
        return switch (status) {
            case REJETEE -> "CORRIGER";
            case EXTRAITE -> "VERIFIER";
            case A_VERIFIER -> "VALIDER";
            case ERREUR_OCR, ERREUR_TRAITEMENT -> "DEBLOQUER";
            default -> throw new IllegalStateException("Invoice status does not require an action: " + status);
        };
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

    private long countUnbalancedEntries(
            Long organizationId,
            boolean hasStartDate,
            LocalDate startDate,
            boolean hasEndDate,
            LocalDate endDate
    ) {
        return accountingEntryLineRepository.findDashboardEntryBalances(
                        organizationId, hasStartDate, startDate, hasEndDate, endDate
                ).stream()
                .filter(balance -> balance.getTotalDebit().compareTo(balance.getTotalCredit()) != 0)
                .count();
    }

    private void validatePeriod(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate must be before or equal to endDate");
        }
    }

    private void validateActionLimit(int actionLimit) {
        if (actionLimit < 1 || actionLimit > MAX_ACTION_INVOICE_LIMIT) {
            throw new IllegalArgumentException("actionLimit must be between 1 and " + MAX_ACTION_INVOICE_LIMIT);
        }
    }
}
