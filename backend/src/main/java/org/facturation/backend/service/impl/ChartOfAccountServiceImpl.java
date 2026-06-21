package org.facturation.backend.service.impl;

import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.service.ChartOfAccountService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ChartOfAccountServiceImpl implements ChartOfAccountService {

    private final ChartOfAccountRepository chartOfAccountRepository;

    public ChartOfAccountServiceImpl(ChartOfAccountRepository chartOfAccountRepository) {
        this.chartOfAccountRepository = chartOfAccountRepository;
    }

    @Override
    public List<ChartOfAccount> findAll() {
        return chartOfAccountRepository.findAll();
    }

    @Override
    public Optional<ChartOfAccount> findById(Long id) {
        return chartOfAccountRepository.findById(id);
    }

    @Override
    public ChartOfAccount save(ChartOfAccount chartOfAccount) {
        return chartOfAccountRepository.save(chartOfAccount);
    }
}
