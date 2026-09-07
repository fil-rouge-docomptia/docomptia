package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AccountingEntryRepository extends JpaRepository<AccountingEntry, Long> {

    Optional<AccountingEntry> findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(Long invoiceId);

    Optional<AccountingEntry> findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(
            Long accountingEntryId,
            Long organizationId
    );

    Optional<AccountingEntry> findByReversedAccountingEntryAccountingEntryId(Long accountingEntryId);

    @Query("""
            select distinct entry
            from AccountingEntry entry
            join fetch entry.invoice invoice
            left join fetch invoice.supplier
            where invoice.organization.organizationId = :organizationId
              and invoice.invoiceStatus.code = 'EXPORTABLE'
              and (:hasStartDate = false or invoice.invoiceDate >= :startDate)
              and (:hasEndDate = false or invoice.invoiceDate <= :endDate)
            order by entry.entryDate, entry.entryNumber, entry.accountingEntryId
            """)
    List<AccountingEntry> findExportableEntriesForCsvExport(
            @Param("organizationId") Long organizationId,
            @Param("hasStartDate") boolean hasStartDate,
            @Param("startDate") LocalDate startDate,
            @Param("hasEndDate") boolean hasEndDate,
            @Param("endDate") LocalDate endDate
    );
}
