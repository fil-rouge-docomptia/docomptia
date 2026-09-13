package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntryMutation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AccountingEntryMutationRepository extends JpaRepository<AccountingEntryMutation, Long> {
    Optional<AccountingEntryMutation> findByAccountingEntryAccountingEntryIdAndRequestKey(Long entryId, String requestKey);
}
