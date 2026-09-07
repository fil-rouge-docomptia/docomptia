package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountingEntryRepository extends JpaRepository<AccountingEntry, Long> {

    Optional<AccountingEntry> findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(Long invoiceId);

    List<AccountingEntry> findByInvoiceInvoiceIdOrderByCreatedAtAscAccountingEntryIdAsc(Long invoiceId);

    Optional<AccountingEntry> findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(
            Long accountingEntryId,
            Long organizationId
    );

    Optional<AccountingEntry> findByReversedAccountingEntryAccountingEntryId(Long accountingEntryId);

}
