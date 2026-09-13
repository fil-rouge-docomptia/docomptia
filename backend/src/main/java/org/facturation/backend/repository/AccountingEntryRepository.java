package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.time.LocalDate;

public interface AccountingEntryRepository extends JpaRepository<AccountingEntry, Long> {

    @Query("""
            select entry from AccountingEntry entry
            left join entry.invoice.supplier supplier
            left join entry.journal journal
            left join entry.exportBatch batch
            where entry.invoice.organization.organizationId = :organizationId
              and (:query = '' or locate(:query, lower(entry.entryNumber)) > 0
                   or locate(:query, lower(entry.label)) > 0
                   or locate(:query, lower(entry.invoice.invoiceNumber)) > 0
                   or locate(:query, lower(supplier.legalName)) > 0)
              and (:status is null or entry.status = :status)
              and (:hasStartDate = false or entry.entryDate >= :startDate)
              and (:hasEndDate = false or entry.entryDate <= :endDate)
              and (:journalId is null or (journal.accountingJournalId = :journalId
                   and journal.organization.organizationId = :organizationId))
              and (:exported is null
                   or (:exported = true and batch.status in ('GENERE', 'ARCHIVE')
                       and batch.organization.organizationId = :organizationId)
                   or (:exported = false and (batch is null or batch.status not in ('GENERE', 'ARCHIVE')
                       or batch.organization.organizationId <> :organizationId)))
              and (:balanced is null
                   or (:balanced = true and (select coalesce(sum(line.debitAmount), 0)
                       - coalesce(sum(line.creditAmount), 0) from AccountingEntryLine line
                       where line.accountingEntry = entry) = 0)
                   or (:balanced = false and (select coalesce(sum(line.debitAmount), 0)
                       - coalesce(sum(line.creditAmount), 0) from AccountingEntryLine line
                       where line.accountingEntry = entry) <> 0))
            """)
    Page<AccountingEntry> findReadPage(@Param("organizationId") Long organizationId,
            @Param("query") String query, @Param("balanced") Boolean balanced,
            @Param("status") String status,
            @Param("hasStartDate") boolean hasStartDate, @Param("startDate") LocalDate startDate,
            @Param("hasEndDate") boolean hasEndDate, @Param("endDate") LocalDate endDate,
            @Param("journalId") Long journalId, @Param("exported") Boolean exported, Pageable pageable);

    Optional<AccountingEntry> findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(Long invoiceId);

    List<AccountingEntry> findByInvoiceInvoiceIdOrderByCreatedAtAscAccountingEntryIdAsc(Long invoiceId);

    Optional<AccountingEntry> findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(
            Long accountingEntryId,
            Long organizationId
    );

    Optional<AccountingEntry> findByReversedAccountingEntryAccountingEntryId(Long accountingEntryId);

}
