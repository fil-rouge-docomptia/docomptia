package org.facturation.backend.service;

import org.facturation.backend.dto.request.AccountingEntryCreationRequest;
import org.facturation.backend.dto.response.AccountingEntryCreationCandidateResponse;
import org.facturation.backend.dto.response.AccountingEntryReadResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AccountingEntryManualCreationService {
    Page<AccountingEntryCreationCandidateResponse> findCandidates(String query, Pageable pageable);
    AccountingEntryReadResponse create(AccountingEntryCreationRequest request);
}
