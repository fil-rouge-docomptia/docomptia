package org.facturation.backend.service;

import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;

public interface AccountingEntryCorrectionService {
    AccountingEntryResponse correctLine(Long entryId, Long lineId, AccountingEntryLineCorrectionRequest request,
            String ifMatch, String key);
    AccountingEntryResponse addLine(Long entryId, AccountingEntryLineCorrectionRequest request, String ifMatch, String key);
    AccountingEntryResponse removeLine(Long entryId, Long lineId, String ifMatch, String key);
}
