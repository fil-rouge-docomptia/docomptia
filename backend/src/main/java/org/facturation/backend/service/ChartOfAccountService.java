package org.facturation.backend.service;

import org.facturation.backend.model.ChartOfAccount;

import java.util.List;
import java.util.Optional;

public interface ChartOfAccountService {

    List<ChartOfAccount> findAll();

    Optional<ChartOfAccount> findById(Long id);

    ChartOfAccount save(ChartOfAccount chartOfAccount);
}
