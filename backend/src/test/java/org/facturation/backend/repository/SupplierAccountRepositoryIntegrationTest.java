package org.facturation.backend.repository;

import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.SupplierAccount;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessApiUsageException;
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
    void excludesAccountWhenItsCollectiveAccountIsDeactivated() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount collectiveAccount = chartOfAccountRepository.findById(1L).orElseThrow();
        Supplier supplier = supplierRepository.findById(1L).orElseThrow();
        saveAccount(organization, collectiveAccount, supplier, "TO_DEACTIVATE", "Compte fournisseur", true);

        collectiveAccount.setActive(false);
        chartOfAccountRepository.saveAndFlush(collectiveAccount);

        assertTrue(supplierAccountRepository
                .findByOrganizationOrganizationIdAndActiveTrue(organization.getOrganizationId())
                .isEmpty());
        assertTrue(supplierAccountRepository
                .findBySupplierSupplierIdAndOrganizationOrganizationIdAndActiveTrue(
                        supplier.getSupplierId(), organization.getOrganizationId())
                .isEmpty());
    }

    @Test
    void excludesInactiveAccountFromSupplierLookup() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount collectiveAccount = chartOfAccountRepository.findById(1L).orElseThrow();
        Supplier supplier = supplierRepository.findById(1L).orElseThrow();
        saveAccount(organization, collectiveAccount, supplier, "INACTIVE_SUPPLIER", "Compte désactivé", false);

        assertTrue(supplierAccountRepository
                .findBySupplierSupplierIdAndOrganizationOrganizationIdAndActiveTrue(
                        supplier.getSupplierId(), organization.getOrganizationId())
                .isEmpty());
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

    @Test
    void rejectsCollectiveAccountOutsideOrganization() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        Organization otherOrganization = organizationRepository.save(organization("collective-account-owner"));
        ChartOfAccount otherCollectiveAccount = chartOfAccountRepository.save(
                collectiveAccount(otherOrganization, "401000"));

        SupplierAccount account = account(
                organization, otherCollectiveAccount, null, "INVALID_ORGANIZATION", "Compte invalide", true);

        assertThrows(InvalidDataAccessApiUsageException.class,
                () -> supplierAccountRepository.saveAndFlush(account));
    }

    @Test
    void rejectsCollectiveAccountOutsideClassFour() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount expenseAccount = chartOfAccountRepository.findById(2L).orElseThrow();

        SupplierAccount wrongClass = account(
                organization, expenseAccount, null, "WRONG_CLASS", "Compte hors classe 4", true);

        assertThrows(InvalidDataAccessApiUsageException.class,
                () -> supplierAccountRepository.saveAndFlush(wrongClass));
    }

    @Test
    void rejectsInactiveCollectiveAccount() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount inactiveCollectiveAccount = collectiveAccount(organization, "409000");
        inactiveCollectiveAccount.setActive(false);
        chartOfAccountRepository.saveAndFlush(inactiveCollectiveAccount);

        SupplierAccount inactive = account(
                organization, inactiveCollectiveAccount, null, "INACTIVE", "Compte collectif inactif", true);

        assertThrows(InvalidDataAccessApiUsageException.class,
                () -> supplierAccountRepository.saveAndFlush(inactive));
    }

    @Test
    void rejectsSupplierOutsideOrganization() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        ChartOfAccount collectiveAccount = chartOfAccountRepository.findById(1L).orElseThrow();
        Organization otherOrganization = organizationRepository.save(organization("supplier-owner"));
        Supplier otherSupplier = supplierRepository.save(supplier(otherOrganization));

        SupplierAccount account = account(
                organization, collectiveAccount, otherSupplier, "INVALID_SUPPLIER", "Compte invalide", true);

        assertThrows(InvalidDataAccessApiUsageException.class,
                () -> supplierAccountRepository.saveAndFlush(account));
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

    private Supplier supplier(Organization organization) {
        LocalDateTime now = LocalDateTime.now();
        Supplier supplier = new Supplier();
        supplier.setOrganization(organization);
        supplier.setName("Supplier");
        supplier.setLegalName("Supplier SAS");
        supplier.setCreatedAt(now);
        supplier.setUpdatedAt(now);
        return supplier;
    }

    private String uniqueDigits() {
        String value = Long.toString(System.nanoTime());
        return value.substring(Math.max(0, value.length() - 14));
    }
}
