package org.facturation.backend.controller;

import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.ExportBatch;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.ExportBatchRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "ALTER TABLE invoices ALTER COLUMN invoice_id RESTART WITH 1000",
        "ALTER TABLE export_batches ALTER COLUMN export_batch_id RESTART WITH 1000",
        "ALTER TABLE accounting_entries ALTER COLUMN accounting_entry_id RESTART WITH 1000",
        "ALTER TABLE accounting_entry_lines ALTER COLUMN accounting_entry_line_id RESTART WITH 1000"
})
class AccountingExportReadControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccountingEntryLineRepository accountingEntryLineRepository;

    @Autowired
    private AccountingEntryRepository accountingEntryRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private ChartOfAccountRepository chartOfAccountRepository;

    @Autowired
    private ExportBatchRepository exportBatchRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    @Autowired
    private InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    private static final String ROOT = "/api/v1/accounting-exports";
    private static final LocalDate START = LocalDate.of(2042, 8, 1);
    private static final LocalDate END = LocalDate.of(2042, 8, 31);

    @Test
    void countsActualEligibilityAndOnlyOrganizationBatchesGeneratedThisMonth() throws Exception {
        User owner = userRepository.findById(1L).orElseThrow();
        var json = tools.jackson.databind.json.JsonMapper.builder().build();
        var before = json.readTree(mockMvc.perform(get(ROOT + "/summary")
                .with(user("admin@facturation-demo.fr").roles("ADMIN")))
                .andReturn().getResponse().getContentAsString());
        eligible(owner, "READY-SUMMARY", "EUR");
        createInvoice(owner, InvoiceStatusCode.EXPORTABLE, "BLOCKED-SUMMARY", "EUR", START);
        User other = createUserForAnotherOrganization();
        createInvoice(other, InvoiceStatusCode.EXPORTABLE, "OTHER-SUMMARY", "EUR", START);
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        batch(owner, "CSV", "GENERE", monthStart);
        batch(owner, "FEC", "ARCHIVE", monthStart.plusDays(1));
        batch(owner, "CSV", "GENERE", monthStart.minusSeconds(1));
        batch(owner, "CSV", "GENERE", monthStart.plusMonths(1));
        batch(other, "CSV", "GENERE", monthStart);
        mockMvc.perform(get(ROOT + "/summary").with(user("admin@facturation-demo.fr").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readyToExport").value(before.get("readyToExport").asLong() + 1))
                .andExpect(jsonPath("$.blockedInvoices").value(before.get("blockedInvoices").asLong() + 1))
                .andExpect(jsonPath("$.exportedThisMonth").value(before.get("exportedThisMonth").asLong() + 2));
    }

    @Test
    void listsOnlyOrganizationCandidatesWithinInclusivePeriodWithEligibilityErrors() throws Exception {
        User owner = userRepository.findById(1L).orElseThrow();
        Invoice first = createInvoice(owner, InvoiceStatusCode.EXPORTABLE, "FIRST", "EUR", START);
        createBalancedEntry(first, owner, "ENTRY-FIRST");
        createInvoice(owner, InvoiceStatusCode.EXPORTABLE, "MISSING-ENTRY", "USD", END);
        createInvoice(owner, InvoiceStatusCode.EXPORTABLE, "OUTSIDE", "EUR", END.plusDays(1));
        createInvoice(owner, InvoiceStatusCode.VALIDEE, "NOT-READY", "EUR", START);
        createInvoice(createUserForAnotherOrganization(), InvoiceStatusCode.EXPORTABLE, "OTHER", "EUR", START);
        Invoice alreadyExported = createInvoice(owner, InvoiceStatusCode.EXPORTABLE, "ALREADY", "EUR", START);
        batch(owner, "CSV", "GENERE", LocalDateTime.now(), alreadyExported);

        mockMvc.perform(get(ROOT + "/selection").header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .param("startDate", START.toString()).param("endDate", END.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationId").value(1))
                .andExpect(jsonPath("$.invoices.length()").value(2))
                .andExpect(jsonPath("$.invoices[0].invoiceNumber").value("FIRST"))
                .andExpect(jsonPath("$.invoices[0].eligible").value(true))
                .andExpect(jsonPath("$.invoices[1].eligible").value(false))
                .andExpect(jsonPath("$.invoices[1].errors[0].code").value("ACCOUNTING_ENTRY_MISSING"))
                .andExpect(jsonPath("$.invoices[1].totalDebit").isEmpty())
                .andExpect(jsonPath("$.totals.length()").value(1))
                .andExpect(jsonPath("$.totals[0].invoiceAmount").value(120));
    }

    @Test
    void confirmsExplicitSubsetAndSeparateCurrencyTotalsWithoutAnyWrites() throws Exception {
        User owner = userRepository.findById(1L).orElseThrow();
        Invoice eur = eligible(owner, "EUR-INVOICE", "EUR");
        Invoice usd = eligible(owner, "USD-INVOICE", "USD");
        eligible(owner, "UNSELECTED", "EUR");
        long batchCount = exportBatchRepository.count();
        long auditCount = auditLogRepository.count();
        long statusHistoryCount = invoiceStatusHistoryRepository.count();
        var originalUpdate = eur.getUpdatedAt();
        String originalNumber = accountingEntryRepository
                .findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(eur.getInvoiceId()).orElseThrow().getEntryNumber();

        mockMvc.perform(post(ROOT + "/selection/confirm").header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(selection(eur.getInvoiceId(), usd.getInvoiceId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoices.length()").value(2))
                .andExpect(jsonPath("$.totals.length()").value(2))
                .andExpect(jsonPath("$.totals[0].currencyCode").value("EUR"))
                .andExpect(jsonPath("$.totals[0].totalDebit").value(120))
                .andExpect(jsonPath("$.totals[0].totalCredit").value(120))
                .andExpect(jsonPath("$.totals[1].currencyCode").value("USD"))
                .andExpect(jsonPath("$.totals[1].invoiceAmount").value(120));
        assertThat(exportBatchRepository.count()).isEqualTo(batchCount);
        assertThat(auditLogRepository.count()).isEqualTo(auditCount);
        assertThat(invoiceStatusHistoryRepository.count()).isEqualTo(statusHistoryCount);
        assertThat(eur.getExportBatch()).isNull();
        assertThat(statusOf(eur)).isEqualTo("EXPORTABLE");
        assertThat(eur.getUpdatedAt()).isEqualTo(originalUpdate);
        assertThat(accountingEntryRepository.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(eur.getInvoiceId())
                .orElseThrow().getEntryNumber()).isEqualTo(originalNumber);
    }

    @Test
    void rejectsUnavailableAndStaleSelectionsWithoutRevealingAnotherOrganization() throws Exception {
        User owner = userRepository.findById(1L).orElseThrow();
        Invoice stale = eligible(owner, "STALE", "EUR");
        stale.setInvoiceStatus(invoiceStatusRepository.findByCode("EXPORTEE").orElseThrow());
        Invoice other = createInvoice(createUserForAnotherOrganization(), InvoiceStatusCode.EXPORTABLE,
                "SECRET-OTHER", "EUR", START);
        for (Long id : List.of(stale.getInvoiceId(), other.getInvoiceId(), 999999L)) {
            mockMvc.perform(post(ROOT + "/selection/confirm").header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                            .contentType(MediaType.APPLICATION_JSON).content(selection(id)))
                    .andExpect(status().isConflict())
                    .andExpect(content().string(containsString("SELECTION_CHANGED")))
                    .andExpect(content().string(not(containsString("SECRET-OTHER"))));
        }
    }

    @Test
    void rechecksVatAndAccountingControlsWhenConfirming() throws Exception {
        User owner = userRepository.findById(1L).orElseThrow();
        Invoice invoice = eligible(owner, "CHANGED-VAT", "EUR");
        invoice.setTotalTva(new BigDecimal("10.00"));
        mockMvc.perform(post(ROOT + "/selection/confirm").header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(selection(invoice.getInvoiceId())))
                .andExpect(status().isConflict()).andExpect(content().string(containsString("VAT_INCONSISTENT")));
        invoice.setTotalTva(new BigDecimal("20.00"));
        chartOfAccountRepository.findById(2L).orElseThrow().setActive(false);
        mockMvc.perform(get(ROOT + "/selection").header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(owner))
                        .param("startDate", START.toString()).param("endDate", END.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.invoices[0].eligible").value(false))
                .andExpect(content().string(containsString("ACCOUNT_INACTIVE")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"invoiceIds\":[]}", "{\"invoiceIds\":[1,1]}",
            "{\"invoiceIds\":[null]}", "{\"invoiceIds\":[-1]}",
            "{\"invoiceIds\":[1],\"startDate\":\"2042-09-01\",\"endDate\":\"2042-08-01\"}"})
    void rejectsInvalidSelectionRequests(String body) throws Exception {
        mockMvc.perform(post(ROOT + "/selection/confirm").with(user("admin@facturation-demo.fr").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
    }

    @Test
    void pagesHistoryDeterministicallyAndExposesOnlyPublicMetadata() throws Exception {
        User owner = userRepository.findById(1L).orElseThrow();
        LocalDateTime created = START.atTime(12, 0);
        ExportBatch first = batch(owner, "CSV", "GENERE", created, eligible(owner, "HISTORY-EUR", "EUR"));
        Invoice usd = eligible(owner, "HISTORY-USD", "USD");
        first.addInvoice(usd);
        ExportBatch last = batch(owner, "CSV", "GENERE", created);
        batch(owner, "FEC", "ARCHIVE", created);
        batch(createUserForAnotherOrganization(), "CSV", "GENERE", created);
        mockMvc.perform(get(ROOT).with(user("admin@facturation-demo.fr").roles("ADMIN"))
                        .param("startDate", START.toString()).param("endDate", START.toString())
                        .param("format", "CSV").param("status", "GENERE").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].exportBatchId").value(last.getExportBatchId()))
                .andExpect(jsonPath("$.content[0].downloadable").value(true))
                .andExpect(jsonPath("$.content[0].filePath").doesNotExist())
                .andExpect(jsonPath("$.content[0].storedFileName").doesNotExist());
        mockMvc.perform(get(ROOT).with(user("admin@facturation-demo.fr").roles("ADMIN"))
                        .param("query", first.getExportBatchId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].invoiceCount").value(2))
                .andExpect(jsonPath("$.content[0].amounts[*].currencyCode", containsInAnyOrder("EUR", "USD")));
    }

    @Test
    void rejectsInvalidHistoryFiltersAndReturnsEmptySelections() throws Exception {
        for (String[] invalid : List.of(new String[]{"page", "-1"}, new String[]{"size", "101"},
                new String[]{"status", "FAILED"}, new String[]{"format", "PDF"})) {
            mockMvc.perform(get(ROOT).with(user("admin@facturation-demo.fr").roles("ADMIN"))
                            .param(invalid[0], invalid[1])).andExpect(status().isBadRequest());
        }
        mockMvc.perform(get(ROOT + "/selection").with(user("admin@facturation-demo.fr").roles("ADMIN"))
                        .param("startDate", "2099-01-01")).andExpect(status().isOk())
                .andExpect(jsonPath("$.invoices").isEmpty()).andExpect(jsonPath("$.totals").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "OPERATEUR_COMPTABLE", "RESPONSABLE_COMPTABLE"})
    void allowsCurrentExportRoles(String role) throws Exception {
        for (String path : List.of("", "/summary", "/selection")) {
            mockMvc.perform(get(ROOT + path).with(user("admin@facturation-demo.fr").roles(role)))
                    .andExpect(status().isOk());
        }
        Invoice invoice = eligible(userRepository.findById(1L).orElseThrow(), "ROLE-" + role, "EUR");
        mockMvc.perform(post(ROOT + "/selection/confirm").with(user("admin@facturation-demo.fr").roles(role))
                        .contentType(MediaType.APPLICATION_JSON).content(selection(invoice.getInvoiceId())))
                .andExpect(status().isOk());
    }

    @Test
    void authenticatesAndRestrictsEveryNewEndpoint() throws Exception {
        for (String path : List.of("", "/summary", "/selection")) {
            mockMvc.perform(get(ROOT + path)).andExpect(status().isUnauthorized());
            mockMvc.perform(get(ROOT + path).with(user("admin@facturation-demo.fr").roles("UNKNOWN")))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(post(ROOT + "/selection/confirm").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post(ROOT + "/selection/confirm").with(user("admin@facturation-demo.fr").roles("UNKNOWN"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    private Invoice eligible(User owner, String number, String currency) {
        Invoice invoice = createInvoice(owner, InvoiceStatusCode.EXPORTABLE, number, currency, START);
        createBalancedEntry(invoice, owner, "ENTRY-" + number);
        return invoice;
    }

    private String selection(Long... ids) {
        return "{\"startDate\":\"" + START + "\",\"endDate\":\"" + END + "\",\"invoiceIds\":" + List.of(ids) + "}";
    }

    private ExportBatch batch(User owner, String format, String status, LocalDateTime created, Invoice... invoices) {
        ExportBatch batch = new ExportBatch();
        batch.setOrganization(owner.getOrganization());
        batch.setCreatedByUser(owner);
        batch.setFormat(format);
        batch.setStatus(status);
        batch.setCreatedAt(created);
        batch.setGeneratedAt(created);
        batch.setFileName("export.csv");
        batch.setFilePath("private/organization/export.csv");
        batch.setStoredFileName("private-storage-key");
        for (Invoice invoice : invoices) batch.addInvoice(invoice);
        return exportBatchRepository.save(batch);
    }

    private Invoice createInvoice(User user, InvoiceStatusCode statusCode, String invoiceNumber, String currencyCode) {
        return createInvoice(user, statusCode, invoiceNumber, currencyCode, LocalDate.of(2026, 8, 15));
    }

    private Invoice createInvoice(
            User user,
            InvoiceStatusCode statusCode,
            String invoiceNumber,
            String currencyCode,
            LocalDate invoiceDate
    ) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(user.getOrganization());
        invoice.setCreatedByUser(user);
        if (user.getOrganization().getOrganizationId().equals(1L)) {
            invoice.setSupplier(supplierRepository.findById(1L).orElseThrow());
        }
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(statusCode.getCode()).orElseThrow());
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setInvoiceDate(invoiceDate);
        invoice.setCurrencyCode(currencyCode);
        invoice.setTotalHt(new BigDecimal("100.00"));
        invoice.setTotalTva(new BigDecimal("20.00"));
        invoice.setTotalTtc(new BigDecimal("120.00"));
        invoice.setCreatedAt(LocalDateTime.now());
        invoice.setUpdatedAt(LocalDateTime.now());
        return invoiceRepository.save(invoice);
    }

    private User createUserForAnotherOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("KAN-126 other organization");
        organization.setLegalName("KAN-126 Other Organization SAS");
        organization.setSiret("73282932000074");
        organization.setEmail("kan-126-other-organization@example.com");
        organization.setDefaultCurrencyCode("EUR");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        organizationRepository.save(organization);

        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findByCode("OPERATEUR_COMPTABLE").orElseThrow());
        user.setFirstName("Other");
        user.setLastName("Operator");
        user.setEmail("kan-126-other-organization-user@example.com");
        user.setPasswordHash("not-used");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private String statusOf(Invoice invoice) {
        return invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow().getInvoiceStatus().getCode();
    }

    private void createBalancedEntry(Invoice invoice, User user, String entryNumber) {
        AccountingEntry entry = createEntry(invoice, user, entryNumber);

        createLine(entry, 1, 2L, "Achat " + invoice.getInvoiceNumber(), "100.00", "0.00");
        createLine(entry, 2, 3L, "TVA " + invoice.getInvoiceNumber(), "20.00", "0.00");
        createLine(entry, 3, 1L, "Fournisseur " + invoice.getInvoiceNumber(), "0.00", "120.00");
    }

    private AccountingEntry createEntry(Invoice invoice, User user, String entryNumber) {
        AccountingEntry entry = new AccountingEntry();
        entry.setInvoice(invoice);
        entry.setCreatedByUser(user);
        entry.setEntryNumber(entryNumber);
        entry.setEntryDate(invoice.getInvoiceDate());
        entry.setLabel("Ecriture " + invoice.getInvoiceNumber());
        entry.setStatus("GENERATED");
        entry.setCreatedAt(LocalDateTime.now());
        entry.setUpdatedAt(LocalDateTime.now());
        return accountingEntryRepository.save(entry);
    }

    private void createLine(
            AccountingEntry entry,
            int lineNumber,
            Long accountId,
            String label,
            String debitAmount,
            String creditAmount
    ) {
        ChartOfAccount account = chartOfAccountRepository.findById(accountId).orElseThrow();
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(entry);
        line.setAccount(account);
        line.setLineNumber(lineNumber);
        line.setLineLabel(label);
        line.setDebitAmount(new BigDecimal(debitAmount));
        line.setCreditAmount(new BigDecimal(creditAmount));
        line.setCreatedAt(LocalDateTime.now());
        accountingEntryLineRepository.save(line);
    }

    private String tokenFor(User user) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(user);
    }
}
