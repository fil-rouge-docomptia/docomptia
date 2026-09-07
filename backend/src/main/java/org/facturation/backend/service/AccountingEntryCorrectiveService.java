package org.facturation.backend.service;

import org.facturation.backend.dto.response.AccountingEntryResponse;

public interface AccountingEntryCorrectiveService {

    AccountingEntryResponse createCorrectiveEntry(Long accountingEntryId);
}
