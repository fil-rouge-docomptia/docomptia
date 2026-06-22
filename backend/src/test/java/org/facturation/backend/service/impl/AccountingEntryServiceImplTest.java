package org.facturation.backend.service.impl;

import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountingEntryServiceImplTest {

    @Mock
    private AccountingEntryRepository accountingEntryRepository;

    @InjectMocks
    private AccountingEntryServiceImpl accountingEntryService;

    @Test
    void findAllReturnsAccountingEntriesFromRepository() {
        AccountingEntry accountingEntry = new AccountingEntry();
        when(accountingEntryRepository.findAll()).thenReturn(List.of(accountingEntry));

        List<AccountingEntry> accountingEntries = accountingEntryService.findAll();

        assertEquals(1, accountingEntries.size());
        assertSame(accountingEntry, accountingEntries.get(0));
        verify(accountingEntryRepository).findAll();
    }

    @Test
    void findByIdReturnsAccountingEntryFromRepository() {
        AccountingEntry accountingEntry = new AccountingEntry();
        when(accountingEntryRepository.findById(1L)).thenReturn(Optional.of(accountingEntry));

        Optional<AccountingEntry> result = accountingEntryService.findById(1L);

        assertSame(accountingEntry, result.orElseThrow());
        verify(accountingEntryRepository).findById(1L);
    }

    @Test
    void saveDelegatesToRepository() {
        AccountingEntry accountingEntry = new AccountingEntry();
        when(accountingEntryRepository.save(accountingEntry)).thenReturn(accountingEntry);

        AccountingEntry savedAccountingEntry = accountingEntryService.save(accountingEntry);

        assertSame(accountingEntry, savedAccountingEntry);
        verify(accountingEntryRepository).save(accountingEntry);
    }
}
