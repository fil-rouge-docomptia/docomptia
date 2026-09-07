package org.facturation.backend.service;

import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountingPieceNumberServiceTest {

    private final OrganizationRepository organizationRepository = mock(OrganizationRepository.class);
    private final AccountingEntryRepository accountingEntryRepository = mock(AccountingEntryRepository.class);
    private final AccountingPieceNumberService service = new AccountingPieceNumberService(
            organizationRepository,
            accountingEntryRepository,
            mock(jakarta.persistence.EntityManager.class)
    );

    @Test
    void assignsOrderedNumbersFromTheOrganizationSequence() {
        Organization organization = organization(1L, 7L);
        AccountingEntry firstEntry = new AccountingEntry();
        AccountingEntry secondEntry = new AccountingEntry();
        when(organizationRepository.findByIdForPieceNumberUpdate(1L)).thenReturn(Optional.of(organization));

        Organization lockedOrganization = service.lockSequence(1L);
        service.assign(lockedOrganization, List.of(firstEntry, secondEntry));

        assertThat(firstEntry.getEntryNumber()).isEqualTo("7");
        assertThat(secondEntry.getEntryNumber()).isEqualTo("8");
        assertThat(organization.getNextAccountingPieceNumber()).isEqualTo(9L);
        verify(accountingEntryRepository).saveAll(List.of(firstEntry, secondEntry));
        verify(organizationRepository).save(organization);
    }

    @Test
    void keepsIndependentSequencesForDifferentOrganizations() {
        Organization firstOrganization = organization(1L, 1L);
        Organization secondOrganization = organization(2L, 1L);
        AccountingEntry firstEntry = new AccountingEntry();
        AccountingEntry secondEntry = new AccountingEntry();
        when(organizationRepository.findByIdForPieceNumberUpdate(1L)).thenReturn(Optional.of(firstOrganization));
        when(organizationRepository.findByIdForPieceNumberUpdate(2L)).thenReturn(Optional.of(secondOrganization));

        service.assign(service.lockSequence(1L), List.of(firstEntry));
        service.assign(service.lockSequence(2L), List.of(secondEntry));

        assertThat(firstEntry.getEntryNumber()).isEqualTo("1");
        assertThat(secondEntry.getEntryNumber()).isEqualTo("1");
        assertThat(firstOrganization.getNextAccountingPieceNumber()).isEqualTo(2L);
        assertThat(secondOrganization.getNextAccountingPieceNumber()).isEqualTo(2L);
    }

    private Organization organization(Long id, Long nextPieceNumber) {
        Organization organization = new Organization();
        organization.setOrganizationId(id);
        organization.setNextAccountingPieceNumber(nextPieceNumber);
        return organization;
    }
}
