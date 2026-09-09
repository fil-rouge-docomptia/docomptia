package org.facturation.backend.repository;

import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.SupplierAccount;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
@Sql(statements = {
        "ALTER TABLE chart_of_accounts ALTER COLUMN account_id RESTART WITH 1000",
        "ALTER TABLE supplier_accounts ALTER COLUMN supplier_account_id RESTART WITH 1000"
})
class SupplierAccountRepositoryIntegrationTest {

    @Autowired
    private SupplierAccountRepository supplierAccountRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private ChartOfAccountRepository chartOfAccountRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Test
    void persistsAccountsWithOptionalSupplierAndFindsOnlyActiveAccountsForOrganization() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount collectiveAccount = chartOfAccountRepository.findById(1L).orElseThrow();
        Supplier supplier = supplierRepository.findById(1L).orElseThrow();
        SupplierAccount linkedAccount = saveAccount(
                organization, collectiveAccount, supplier, "ORANGE", "Orange SA", true);
        saveAccount(organization, collectiveAccount, null, "A_RAPPROCHER", "Compte importe", false);

        var activeAccounts = supplierAccountRepository
                .findByOrganizationOrganizationIdAndActiveTrue(organization.getOrganizationId());

        assertEquals(1, activeAccounts.size());
        assertEquals(linkedAccount.getSupplierAccountId(), activeAccounts.getFirst().getSupplierAccountId());
        assertEquals(supplier.getSupplierId(), activeAccounts.getFirst().getSupplier().getSupplierId());
        assertTrue(supplierAccountRepository
                .findBySupplierSupplierIdAndOrganizationOrganizationIdAndActiveTrue(
                        supplier.getSupplierId(), organization.getOrganizationId())
                .isPresent());
    }

    @Test
    void preventsDuplicateCodeWithinOrganization() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount collectiveAccount = chartOfAccountRepository.findById(1L).orElseThrow();
        saveAccount(organization, collectiveAccount, null, "FOURNISSEUR", "Premier compte", true);

        SupplierAccount duplicate = account(
                organization, collectiveAccount, null, "FOURNISSEUR", "Compte en doublon", true);

        assertThrows(DataIntegrityViolationException.class,
                () -> supplierAccountRepository.saveAndFlush(duplicate));
    }

    @Test
    void allowsSameCodeInAnotherOrganizationAndKeepsQueriesIsolated() {
        Organization firstOrganization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount firstCollectiveAccount = chartOfAccountRepository.findById(1L).orElseThrow();
        Organization secondOrganization = organizationRepository.save(organization("other"));
        ChartOfAccount secondCollectiveAccount = chartOfAccountRepository.save(
                collectiveAccount(secondOrganization, "401000"));
        saveAccount(firstOrganization, firstCollectiveAccount, null, "COMMUN", "Premier", true);

        SupplierAccount secondAccount = saveAccount(
                secondOrganization, secondCollectiveAccount, null, "COMMUN", "Second", true);

        assertNotNull(secondAccount.getSupplierAccountId());
        var secondOrganizationAccounts = supplierAccountRepository
                .findByOrganizationOrganizationIdAndActiveTrue(secondOrganization.getOrganizationId());
        assertEquals(1, secondOrganizationAccounts.size());
        assertEquals(secondAccount.getSupplierAccountId(), secondOrganizationAccounts.getFirst().getSupplierAccountId());
    }

    private SupplierAccount saveAccount(
            Organization organization,
            ChartOfAccount collectiveAccount,
            Supplier supplier,
            String code,
            String label,
            boolean active
    ) {
        return supplierAccountRepository.saveAndFlush(
                account(organization, collectiveAccount, supplier, code, label, active));
    }

    private SupplierAccount account(
            Organization organization,
            ChartOfAccount collectiveAccount,
            Supplier supplier,
            String code,
            String label,
            boolean active
    ) {
        LocalDateTime now = LocalDateTime.now();
        SupplierAccount account = new SupplierAccount();
        account.setOrganization(organization);
        account.setCollectiveAccount(collectiveAccount);
        account.setSupplier(supplier);
        account.setCode(code);
        account.setLabel(label);
        account.setActive(active);
        account.setCreatedAt(now);
        account.setUpdatedAt(now);
        return account;
    }

    private Organization organization(String suffix) {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("Organization " + suffix);
        organization.setLegalName("Organization " + suffix + " SAS");
        organization.setSiret(uniqueDigits());
        organization.setEmail(suffix + "@example.com");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        return organization;
    }

    private ChartOfAccount collectiveAccount(Organization organization, String accountNumber) {
        LocalDateTime now = LocalDateTime.now();
        ChartOfAccount account = new ChartOfAccount();
        account.setOrganization(organization);
        account.setAccountNumber(accountNumber);
        account.setAccountLabel("Fournisseurs");
        account.setAccountType("PASSIF");
        account.setActive(true);
        account.setCreatedAt(now);
        account.setUpdatedAt(now);
        return account;
    }

    private String uniqueDigits() {
        String value = Long.toString(System.nanoTime());
        return value.substring(Math.max(0, value.length() - 14));
    }
}
