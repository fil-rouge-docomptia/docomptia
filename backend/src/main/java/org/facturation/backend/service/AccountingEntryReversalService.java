package org.facturation.backend.service;

import org.facturation.backend.dto.response.AccountingEntryResponse;

public interface AccountingEntryReversalService {

    AccountingEntryResponse createReversal(Long accountingEntryId);
}
