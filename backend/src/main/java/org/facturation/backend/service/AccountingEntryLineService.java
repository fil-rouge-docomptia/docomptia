package org.facturation.backend.service;

import org.facturation.backend.model.AccountingEntryLine;

import java.util.List;
import java.util.Optional;

public interface AccountingEntryLineService {

    List<AccountingEntryLine> findAll();

    Optional<AccountingEntryLine> findById(Long id);

    AccountingEntryLine save(AccountingEntryLine accountingEntryLine);
}
