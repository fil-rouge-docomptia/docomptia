package org.facturation.backend.service;

import jakarta.persistence.EntityManager;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AccountingPieceNumberService {

    private final EntityManager entityManager;
    private final OrganizationRepository organizationRepository;
    private final AccountingEntryRepository accountingEntryRepository;

    public AccountingPieceNumberService(
            OrganizationRepository organizationRepository,
            AccountingEntryRepository accountingEntryRepository,
            EntityManager entityManager
    ) {
        this.entityManager = entityManager;
        this.organizationRepository = organizationRepository;
        this.accountingEntryRepository = accountingEntryRepository;
    }

    public Organization lockSequence(Long organizationId) {
        Organization organization = organizationRepository.findByIdForPieceNumberUpdate(organizationId)
                .orElseThrow(() -> new IllegalStateException("Organization not found while assigning piece numbers"));
        // Authentication may have loaded this entity before waiting for another export's lock.
        entityManager.refresh(organization);
        return organization;
    }

    public void assign(Organization organization, List<AccountingEntry> accountingEntries) {
        long nextPieceNumber = organization.getNextAccountingPieceNumber();

        for (AccountingEntry accountingEntry : accountingEntries) {
            accountingEntry.setEntryNumber(Long.toString(nextPieceNumber));
            nextPieceNumber = Math.incrementExact(nextPieceNumber);
        }

        organization.setNextAccountingPieceNumber(nextPieceNumber);
        accountingEntryRepository.saveAll(accountingEntries);
        organizationRepository.save(organization);
    }
}
