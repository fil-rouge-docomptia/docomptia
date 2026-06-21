package org.facturation.backend.service.impl;

import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.service.AccountingEntryLineService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AccountingEntryLineServiceImpl implements AccountingEntryLineService {

    private final AccountingEntryLineRepository accountingEntryLineRepository;

    public AccountingEntryLineServiceImpl(AccountingEntryLineRepository accountingEntryLineRepository) {
        this.accountingEntryLineRepository = accountingEntryLineRepository;
    }

    @Override
    public List<AccountingEntryLine> findAll() {
        return accountingEntryLineRepository.findAll();
    }

    @Override
    public Optional<AccountingEntryLine> findById(Long id) {
        return accountingEntryLineRepository.findById(id);
    }

    @Override
    public AccountingEntryLine save(AccountingEntryLine accountingEntryLine) {
        return accountingEntryLineRepository.save(accountingEntryLine);
    }
}
