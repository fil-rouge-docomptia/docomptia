package org.facturation.backend.service;

import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;

public interface AccountingEntryCorrectionService {

    AccountingEntryResponse correctLine(
            Long accountingEntryId,
            Long accountingEntryLineId,
            AccountingEntryLineCorrectionRequest request
    );
}
