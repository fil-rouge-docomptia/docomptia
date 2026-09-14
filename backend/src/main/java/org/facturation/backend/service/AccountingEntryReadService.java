package org.facturation.backend.service;

import org.facturation.backend.dto.response.AccountingEntryReadResponse;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.AccountingEntryExportStatus;
import org.facturation.backend.dto.response.AccountingJournalResponse;
import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AccountingEntryReadService {
    Page<AccountingEntryReadResponse> findPage(String query, Boolean balanced,
            AccountingEntryStatusCode status, LocalDate startDate, LocalDate endDate,
            Long journalId, AccountingEntryExportStatus exportStatus, Pageable pageable);

    Page<AccountingJournalResponse> findJournals(Pageable pageable);

    AccountingEntryReadResponse findDetails(Long id);
}
