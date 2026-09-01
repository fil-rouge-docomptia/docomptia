package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntryLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AccountingEntryLineRepository extends JpaRepository<AccountingEntryLine, Long> {

    interface DashboardEntryBalance {
        BigDecimal getTotalDebit();

        BigDecimal getTotalCredit();
    }

    @Query("""
            select coalesce(sum(line.debitAmount), 0) as totalDebit,
                   coalesce(sum(line.creditAmount), 0) as totalCredit
            from AccountingEntryLine line
            where line.accountingEntry.invoice.organization.organizationId = :organizationId
              and (:hasStartDate = false or line.accountingEntry.invoice.invoiceDate >= :startDate)
              and (:hasEndDate = false or line.accountingEntry.invoice.invoiceDate <= :endDate)
            group by line.accountingEntry.accountingEntryId
            """)
    List<DashboardEntryBalance> findDashboardEntryBalances(
            @Param("organizationId") Long organizationId,
            @Param("hasStartDate") boolean hasStartDate,
            @Param("startDate") LocalDate startDate,
            @Param("hasEndDate") boolean hasEndDate,
            @Param("endDate") LocalDate endDate
    );

    List<AccountingEntryLine> findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(Long accountingEntryId);

    Optional<AccountingEntryLine>
            findByAccountingEntryLineIdAndAccountingEntryAccountingEntryIdAndAccountingEntryInvoiceOrganizationOrganizationId(
                    Long accountingEntryLineId,
                    Long accountingEntryId,
                    Long organizationId
            );
}
