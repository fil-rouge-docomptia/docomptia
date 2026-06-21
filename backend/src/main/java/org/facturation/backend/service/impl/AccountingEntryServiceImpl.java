package org.facturation.backend.service.impl;

import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.service.AccountingEntryService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AccountingEntryServiceImpl implements AccountingEntryService {

    private final AccountingEntryRepository accountingEntryRepository;

    public AccountingEntryServiceImpl(AccountingEntryRepository accountingEntryRepository) {
        this.accountingEntryRepository = accountingEntryRepository;
    }

    @Override
    public List<AccountingEntry> findAll() {
        return accountingEntryRepository.findAll();
    }

    @Override
    public Optional<AccountingEntry> findById(Long id) {
        return accountingEntryRepository.findById(id);
    }

    @Override
    public AccountingEntry save(AccountingEntry accountingEntry) {
        return accountingEntryRepository.save(accountingEntry);
    }
}
