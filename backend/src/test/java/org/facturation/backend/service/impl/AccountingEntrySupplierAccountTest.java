package org.facturation.backend.service.impl;

import org.facturation.backend.exception.AccountingEntryPrerequisitesException;
import org.facturation.backend.mapper.AccountingEntryMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AccountingRule;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.SupplierAccount;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AccountingRuleRepository;
import org.facturation.backend.repository.SupplierAccountRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AccountingEntrySupplierAccountTest {

    private final AccountingEntryRepository entryRepository = mock(AccountingEntryRepository.class);
    private final AccountingEntryLineRepository lineRepository = mock(AccountingEntryLineRepository.class);
    private final AccountingRuleRepository ruleRepository = mock(AccountingRuleRepository.class);
    private final SupplierAccountRepository supplierAccountRepository = mock(SupplierAccountRepository.class);
    private final AccountingEntryServiceImpl service = new AccountingEntryServiceImpl(
            entryRepository,
            lineRepository,
            ruleRepository,
            supplierAccountRepository
    );

    @Test
    void usesActiveSupplierAccountOnSupplierCreditLine() {
        Fixture fixture = fixture();
        SupplierAccount supplierAccount = supplierAccount(fixture, fixture.collectiveAccount(), true);
        fixture.rule().setSupplierAccount(null);
        prepareGeneration(fixture, Optional.of(supplierAccount));

        service.generateFromInvoice(fixture.invoice(), fixture.user());

        AccountingEntryLine supplierLine = savedLines().get(2);
        assertThat(supplierLine.getAccount()).isSameAs(fixture.collectiveAccount());
        assertThat(supplierLine.getSupplierAccount()).isSameAs(supplierAccount);
        var response = new AccountingEntryMapper().toResponse(new AccountingEntry(), List.of(supplierLine));
        assertThat(response.getLines().getFirst().getSupplierAccountCode()).isEqualTo("ORANGE");
        assertThat(response.getLines().getFirst().getSupplierAccountLabel()).isEqualTo("Orange SA");
    }

    @Test
    void fallsBackToRuleAccountWhenSupplierHasNoActiveAccount() {
        Fixture fixture = fixture();
        prepareGeneration(fixture, Optional.empty());

        service.generateFromInvoice(fixture.invoice(), fixture.user());

        AccountingEntryLine supplierLine = savedLines().get(2);
        assertThat(supplierLine.getAccount()).isSameAs(fixture.fallbackAccount());
        assertThat(supplierLine.getSupplierAccount()).isNull();
    }

    @Test
    void blocksGenerationWhenRequiredFallbackAccountIsMissing() {
        Fixture fixture = fixture();
        fixture.rule().setSupplierAccount(null);
        prepareGeneration(fixture, Optional.empty());

        assertThatThrownBy(() -> service.generateFromInvoice(fixture.invoice(), fixture.user()))
                .isInstanceOf(AccountingEntryPrerequisitesException.class)
                .extracting("missingPrerequisites")
                .isEqualTo(List.of("supplierAccount"));
    }

    private void prepareGeneration(Fixture fixture, Optional<SupplierAccount> supplierAccount) {
        when(entryRepository.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(100L))
                .thenReturn(Optional.empty());
        when(entryRepository.save(any(AccountingEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ruleRepository.findByOrganizationOrganizationIdAndActiveTrueOrderByPriorityAscAccountingRuleIdAsc(1L))
                .thenReturn(List.of(fixture.rule()));
        when(supplierAccountRepository
                .findBySupplierSupplierIdAndOrganizationOrganizationIdAndActiveTrue(10L, 1L))
                .thenReturn(supplierAccount);
    }

    private List<AccountingEntryLine> savedLines() {
        ArgumentCaptor<AccountingEntryLine> captor = ArgumentCaptor.forClass(AccountingEntryLine.class);
        org.mockito.Mockito.verify(lineRepository, org.mockito.Mockito.times(3)).save(captor.capture());
        return captor.getAllValues();
    }

    private Fixture fixture() {
        Organization organization = new Organization();
        organization.setOrganizationId(1L);

        Supplier supplier = new Supplier();
        supplier.setSupplierId(10L);
        supplier.setOrganization(organization);
        supplier.setName("Orange");
        supplier.setLegalName("Orange SA");

        ChartOfAccount expenseAccount = account(2L, organization, "626000");
        ChartOfAccount vatAccount = account(3L, organization, "445660");
        ChartOfAccount fallbackAccount = account(1L, organization, "401000");
        ChartOfAccount collectiveAccount = account(4L, organization, "401100");

        AccountingRule rule = new AccountingRule();
        rule.setOrganization(organization);
        rule.setSupplier(supplier);
        rule.setExpenseAccount(expenseAccount);
        rule.setVatAccount(vatAccount);
        rule.setSupplierAccount(fallbackAccount);

        Invoice invoice = new Invoice();
        invoice.setInvoiceId(100L);
        invoice.setOrganization(organization);
        invoice.setSupplier(supplier);
        invoice.setInvoiceNumber("INV-100");
        invoice.setTotalHt(new BigDecimal("100.00"));
        invoice.setTotalTva(new BigDecimal("20.00"));
        invoice.setTotalTtc(new BigDecimal("120.00"));

        return new Fixture(invoice, new User(), rule, fallbackAccount, collectiveAccount);
    }

    private ChartOfAccount account(Long id, Organization organization, String number) {
        ChartOfAccount account = new ChartOfAccount();
        account.setAccountId(id);
        account.setOrganization(organization);
        account.setAccountNumber(number);
        account.setAccountLabel(number);
        account.setActive(true);
        return account;
    }

    private SupplierAccount supplierAccount(Fixture fixture, ChartOfAccount collectiveAccount, boolean active) {
        SupplierAccount account = new SupplierAccount();
        account.setOrganization(fixture.invoice().getOrganization());
        account.setSupplier(fixture.invoice().getSupplier());
        account.setCollectiveAccount(collectiveAccount);
        account.setCode("ORANGE");
        account.setLabel("Orange SA");
        account.setActive(active);
        return account;
    }

    private record Fixture(
            Invoice invoice,
            User user,
            AccountingRule rule,
            ChartOfAccount fallbackAccount,
            ChartOfAccount collectiveAccount
    ) {
    }
}
