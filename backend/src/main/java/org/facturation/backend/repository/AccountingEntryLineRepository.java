package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingEntryLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountingEntryLineRepository extends JpaRepository<AccountingEntryLine, Long> {

    List<AccountingEntryLine> findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(Long accountingEntryId);

    Optional<AccountingEntryLine>
            findByAccountingEntryLineIdAndAccountingEntryAccountingEntryIdAndAccountingEntryInvoiceOrganizationOrganizationId(
                    Long accountingEntryLineId,
                    Long accountingEntryId,
                    Long organizationId
            );
}
