package org.facturation.backend.service;

import org.facturation.backend.dto.request.ChartOfAccountCreateRequest;
import org.facturation.backend.dto.request.ChartOfAccountUpdateRequest;
import org.facturation.backend.dto.response.ChartOfAccountResponse;
import org.facturation.backend.model.ChartOfAccount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface ChartOfAccountService {

    List<ChartOfAccount> findAll();

    Optional<ChartOfAccount> findById(Long id);

    ChartOfAccount save(ChartOfAccount chartOfAccount);

    Page<ChartOfAccountResponse> findPage(Pageable pageable);

    ChartOfAccountResponse findDetailsById(Long id);

    ChartOfAccountResponse create(ChartOfAccountCreateRequest request);

    ChartOfAccountResponse update(Long id, ChartOfAccountUpdateRequest request);

    ChartOfAccountResponse deactivate(Long id);
}
