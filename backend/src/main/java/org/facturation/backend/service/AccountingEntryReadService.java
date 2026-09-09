package org.facturation.backend.service;

import org.facturation.backend.dto.response.AccountingEntryReadResponse;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AccountingEntryReadService {
    Page<AccountingEntryReadResponse> findPage(String query, Boolean balanced,
            AccountingEntryStatusCode status, Pageable pageable);

    AccountingEntryReadResponse findDetails(Long id);
}
