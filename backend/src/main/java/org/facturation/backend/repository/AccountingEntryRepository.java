package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AccountingEntryRepository extends JpaRepository<AccountingEntry, Long> {

    Optional<AccountingEntry> findByInvoiceInvoiceId(Long invoiceId);
}
