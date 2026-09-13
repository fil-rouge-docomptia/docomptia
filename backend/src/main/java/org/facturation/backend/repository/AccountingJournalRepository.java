package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingJournal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountingJournalRepository extends JpaRepository<AccountingJournal, Long> {
    Page<AccountingJournal> findByOrganizationOrganizationId(Long organizationId, Pageable pageable);
}
