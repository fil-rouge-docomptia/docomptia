package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface AccountingEntryRepository extends JpaRepository<AccountingEntry, Long> {

    @Query("""
            select entry from AccountingEntry entry
            left join entry.invoice.supplier supplier
            where entry.invoice.organization.organizationId = :organizationId
              and (:query = '' or locate(:query, lower(entry.entryNumber)) > 0
                   or locate(:query, lower(entry.label)) > 0
                   or locate(:query, lower(entry.invoice.invoiceNumber)) > 0
                   or locate(:query, lower(supplier.legalName)) > 0)
              and (:status is null or entry.status = :status)
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
            @Param("status") String status, Pageable pageable);

    Optional<AccountingEntry> findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(Long invoiceId);

    List<AccountingEntry> findByInvoiceInvoiceIdOrderByCreatedAtAscAccountingEntryIdAsc(Long invoiceId);

    Optional<AccountingEntry> findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(
            Long accountingEntryId,
            Long organizationId
    );

    Optional<AccountingEntry> findByReversedAccountingEntryAccountingEntryId(Long accountingEntryId);

}
