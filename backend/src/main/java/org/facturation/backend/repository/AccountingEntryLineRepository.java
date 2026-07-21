package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntryLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccountingEntryLineRepository extends JpaRepository<AccountingEntryLine, Long> {

    List<AccountingEntryLine> findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(Long accountingEntryId);
}
