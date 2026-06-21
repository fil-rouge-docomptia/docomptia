package org.facturation.backend.service;

import org.facturation.backend.model.AccountingEntry;

import java.util.List;
import java.util.Optional;

public interface AccountingEntryService {

    List<AccountingEntry> findAll();

    Optional<AccountingEntry> findById(Long id);

    AccountingEntry save(AccountingEntry accountingEntry);
}
