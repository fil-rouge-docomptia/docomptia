package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Transactional
@WithMockUser(username = "admin@facturation-demo.fr")
@Sql(statements = {
        "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 1000",
        "ALTER TABLE users ALTER COLUMN user_id RESTART WITH 1000",
        "ALTER TABLE suppliers ALTER COLUMN supplier_id RESTART WITH 1000",
        "ALTER TABLE invoices ALTER COLUMN invoice_id RESTART WITH 1000"
})
class InvoiceOrganizationIsolationIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;
    private final OrganizationRepository organizationRepository;
    private final RoleRepository roleRepository;
    private final SupplierRepository supplierRepository;
    private final UserRepository userRepository;

    @Autowired
    InvoiceOrganizationIsolationIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            InvoiceStatusRepository invoiceStatusRepository,
            OrganizationRepository organizationRepository,
            RoleRepository roleRepository,
            SupplierRepository supplierRepository,
            UserRepository userRepository
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusRepository = invoiceStatusRepository;
        this.organizationRepository = organizationRepository;
        this.roleRepository = roleRepository;
        this.supplierRepository = supplierRepository;
        this.userRepository = userRepository;
    }

    @Test
    void searchesInvoicesOnlyWithinCurrentOrganization() {
        Organization currentOrganization = organizationRepository.findById(1L).orElseThrow();
        User currentUser = userRepository.findById(1L).orElseThrow();
        Supplier currentSupplier = createSupplier(currentOrganization, "Shared supplier", "11111111111111");
        Invoice visibleInvoice = createInvoice(currentOrganization, currentUser, currentSupplier, "VISIBLE-156");

        Organization otherOrganization = createOrganization();
        User otherUser = createUser(otherOrganization);
        Supplier otherSupplier = createSupplier(otherOrganization, "Shared supplier", "22222222222222");
        createInvoice(otherOrganization, otherUser, otherSupplier, "HIDDEN-156");

        List<InvoiceListItemResponse> results = invoiceService
                .searchInvoices(
                        null, "Shared supplier", null, null, null, null, null, null, Pageable.unpaged())
                .getContent();

        assertEquals(List.of(visibleInvoice.getInvoiceId()), results.stream()
                .map(InvoiceListItemResponse::getInvoiceId)
                .toList());
    }

    @Test
    void searchesBySupplierNameOrIdentifierWithinCurrentOrganization() {
        Organization currentOrganization = organizationRepository.findById(1L).orElseThrow();
        User currentUser = userRepository.findById(1L).orElseThrow();
        Supplier matchingSupplier = createSupplier(currentOrganization, "KAN-114 partner", "66666666666666");
        matchingSupplier.setVatNumber("FR66666666666");
        supplierRepository.save(matchingSupplier);
        Invoice matchingInvoice = createInvoice(
                currentOrganization, currentUser, matchingSupplier, "KAN-114-SUPPLIER");

        Organization otherOrganization = createOrganization();
        User otherUser = createUser(otherOrganization);
        Supplier otherSupplier = createSupplier(otherOrganization, "KAN-114 partner", "77777777777777");
        createInvoice(otherOrganization, otherUser, otherSupplier, "HIDDEN-KAN-114-SUPPLIER");

        assertSearchReturnsInvoice(matchingInvoice, "kan-114 PART", null);
        assertSearchReturnsInvoice(matchingInvoice, matchingSupplier.getSupplierId().toString(), null);
        assertSearchReturnsInvoice(matchingInvoice, matchingSupplier.getSiret(), null);
        assertSearchReturnsInvoice(matchingInvoice, "fr66666666666", null);
        assertEquals(List.of(), invoiceService.searchInvoices(
                null, otherSupplier.getSupplierId().toString(), null, null, null, null, null, null,
                Pageable.unpaged()
        ).getContent());
    }

    @Test
    void searchesByClientNameOrIdentifierWithinCurrentOrganization() {
        Organization currentOrganization = organizationRepository.findById(1L).orElseThrow();
        User currentUser = userRepository.findById(1L).orElseThrow();
        Supplier supplier = createSupplier(currentOrganization, "KAN-114 client supplier", "88888888888888");
        Invoice matchingInvoice = createInvoice(currentOrganization, currentUser, supplier, "KAN-114-CLIENT");
        Organization otherOrganization = createOrganization();

        assertSearchReturnsInvoice(matchingInvoice, null, currentOrganization.getName().toUpperCase());
        assertSearchReturnsInvoice(matchingInvoice, null, currentOrganization.getOrganizationId().toString());
        assertSearchReturnsInvoice(matchingInvoice, null, currentOrganization.getSiret());
        assertEquals(List.of(), invoiceService.searchInvoices(
                null, null, otherOrganization.getOrganizationId().toString(), null, null, null, null, null,
                Pageable.unpaged()
        ).getContent());
    }

    @Test
    void searchesByExactOrPartialInvoiceNumberIgnoringCaseWithinCurrentOrganization() {
        Organization currentOrganization = organizationRepository.findById(1L).orElseThrow();
        User currentUser = userRepository.findById(1L).orElseThrow();
        Supplier currentSupplier = createSupplier(currentOrganization, "KAN-113 supplier", "44444444444444");
        Invoice matchingInvoice = createInvoice(currentOrganization, currentUser, currentSupplier, "FAC-2026-AbC-001");
        createInvoice(currentOrganization, currentUser, currentSupplier, "OTHER-2026-001");

        Organization otherOrganization = createOrganization();
        User otherUser = createUser(otherOrganization);
        Supplier otherSupplier = createSupplier(otherOrganization, "Other KAN-113 supplier", "55555555555555");
        createInvoice(otherOrganization, otherUser, otherSupplier, "FAC-2026-ABC-001");

        Page<InvoiceListItemResponse> exactResults = invoiceService.searchInvoices(
                null, null, null, "fac-2026-abc-001", null, null, null, null, Pageable.unpaged());
        Page<InvoiceListItemResponse> partialResults = invoiceService.searchInvoices(
                null, null, null, "2026-aBc", null, null, null, null, Pageable.unpaged());
        Page<InvoiceListItemResponse> noResults = invoiceService.searchInvoices(
                null, null, null, "missing", null, null, null, null, Pageable.unpaged());

        assertEquals(List.of(matchingInvoice.getInvoiceId()), exactResults.stream()
                .map(InvoiceListItemResponse::getInvoiceId)
                .toList());
        assertEquals(List.of(matchingInvoice.getInvoiceId()), partialResults.stream()
                .map(InvoiceListItemResponse::getInvoiceId)
                .toList());
        assertEquals(List.of(), noResults.getContent());
    }

    @Test
    void filtersByExactInvoiceAndDueDates() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User currentUser = userRepository.findById(1L).orElseThrow();
        Supplier supplier = createSupplier(organization, "KAN-115 exact dates", "12121212121212");
        Invoice matchingInvoice = createInvoice(organization, currentUser, supplier, "KAN-115-EXACT");
        matchingInvoice.setInvoiceDate(LocalDate.of(2026, 8, 10));
        matchingInvoice.setDueDate(LocalDate.of(2026, 9, 10));
        invoiceRepository.save(matchingInvoice);
        Invoice otherDueDate = createInvoice(organization, currentUser, supplier, "KAN-115-OTHER-DUE-DATE");
        otherDueDate.setInvoiceDate(LocalDate.of(2026, 8, 10));
        otherDueDate.setDueDate(LocalDate.of(2026, 9, 11));
        invoiceRepository.save(otherDueDate);
        Invoice missingDueDate = createInvoice(organization, currentUser, supplier, "KAN-115-NO-DUE-DATE");
        missingDueDate.setInvoiceDate(LocalDate.of(2026, 8, 10));
        missingDueDate.setDueDate(null);
        invoiceRepository.save(missingDueDate);

        Page<InvoiceListItemResponse> results = invoiceService.searchInvoices(
                null, null, null, null, "2026-08-10", "2026-09-10", null, null, Pageable.unpaged());

        assertEquals(List.of(matchingInvoice.getInvoiceId()), results.map(InvoiceListItemResponse::getInvoiceId)
                .getContent());
    }

    @Test
    void filtersByInclusiveInvoiceDatePeriodAndIgnoresMissingDates() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User currentUser = userRepository.findById(1L).orElseThrow();
        Supplier supplier = createSupplier(organization, "KAN-115 period", "13131313131313");
        Invoice startBoundary = createInvoice(organization, currentUser, supplier, "KAN-115-START");
        startBoundary.setInvoiceDate(LocalDate.of(2026, 8, 1));
        invoiceRepository.save(startBoundary);
        Invoice endBoundary = createInvoice(organization, currentUser, supplier, "KAN-115-END");
        endBoundary.setInvoiceDate(LocalDate.of(2026, 8, 31));
        invoiceRepository.save(endBoundary);
        Invoice outsidePeriod = createInvoice(organization, currentUser, supplier, "KAN-115-OUTSIDE");
        outsidePeriod.setInvoiceDate(LocalDate.of(2026, 9, 1));
        invoiceRepository.save(outsidePeriod);
        Invoice missingDate = createInvoice(organization, currentUser, supplier, "KAN-115-NO-DATE");
        missingDate.setInvoiceDate(null);
        invoiceRepository.save(missingDate);

        Page<InvoiceListItemResponse> results = invoiceService.searchInvoices(
                null, "KAN-115 period", null, null, null, null, "2026-08-01", "2026-08-31",
                Pageable.unpaged());

        assertEquals(List.of("KAN-115-END", "KAN-115-START"), results.stream()
                .map(InvoiceListItemResponse::getInvoiceNumber)
                .sorted()
                .toList());
    }

    @Test
    void acceptsAnOpenPeriodAndRejectsAnInvertedPeriod() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User currentUser = userRepository.findById(1L).orElseThrow();
        Supplier supplier = createSupplier(organization, "KAN-115 open period", "14141414141414");
        Invoice invoice = createInvoice(organization, currentUser, supplier, "KAN-115-OPEN");
        invoice.setInvoiceDate(LocalDate.of(2026, 8, 15));
        invoiceRepository.save(invoice);

        Page<InvoiceListItemResponse> results = invoiceService.searchInvoices(
                null, "KAN-115 open period", null, null, null, null, "2026-08-01", null,
                Pageable.unpaged());

        assertEquals(List.of(invoice.getInvoiceId()), results.map(InvoiceListItemResponse::getInvoiceId).getContent());
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> invoiceService.searchInvoices(
                        null, null, null, null, null, null, "2026-08-31", "2026-08-01",
                        Pageable.unpaged()));
        assertEquals("startDate must be before or equal to endDate", exception.getMessage());
    }

    @Test
    void paginatesAndSortsFilteredInvoicesInBothDirections() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        User currentUser = userRepository.findById(1L).orElseThrow();
        Supplier supplier = createSupplier(organization, "KAN-112 supplier", "33333333333333");
        Invoice firstInvoice = createInvoice(organization, currentUser, supplier, "KAN-112-A");
        firstInvoice.setInvoiceDate(LocalDate.of(2026, 8, 1));
        firstInvoice.setInvoiceStatus(invoiceStatusRepository.findByCode("DEPOSEE").orElseThrow());
        firstInvoice.setTotalTtc(new BigDecimal("100.00"));
        invoiceRepository.save(firstInvoice);
        Invoice secondInvoice = createInvoice(organization, currentUser, supplier, "KAN-112-B");
        secondInvoice.setInvoiceDate(LocalDate.of(2026, 8, 2));
        secondInvoice.setInvoiceStatus(invoiceStatusRepository.findByCode("VALIDEE").orElseThrow());
        secondInvoice.setTotalTtc(new BigDecimal("200.00"));
        invoiceRepository.save(secondInvoice);
        Invoice thirdInvoice = createInvoice(organization, currentUser, supplier, "KAN-112-C");
        thirdInvoice.setInvoiceDate(LocalDate.of(2026, 8, 3));
        thirdInvoice.setTotalTtc(new BigDecimal("300.00"));
        invoiceRepository.save(thirdInvoice);

        Page<InvoiceListItemResponse> firstPage = invoiceService.searchInvoices(
                null,
                "KAN-112 supplier",
                null,
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(0, 2, Sort.by(Sort.Direction.DESC, "totalTtc"))
        );
        Page<InvoiceListItemResponse> ascendingDates = invoiceService.searchInvoices(
                null,
                "KAN-112 supplier",
                null,
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(0, 3, Sort.by(Sort.Direction.ASC, "invoiceDate"))
        );
        Page<InvoiceListItemResponse> ascendingStatuses = invoiceService.searchInvoices(
                null,
                "KAN-112 supplier",
                null,
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(0, 3, Sort.by(Sort.Direction.ASC, "invoiceStatus.code"))
        );

        assertEquals(3, firstPage.getTotalElements());
        assertEquals(2, firstPage.getTotalPages());
        assertEquals(List.of("KAN-112-C", "KAN-112-B"), firstPage.getContent().stream()
                .map(InvoiceListItemResponse::getInvoiceNumber)
                .toList());
        assertEquals(List.of("KAN-112-A", "KAN-112-B", "KAN-112-C"), ascendingDates.getContent().stream()
                .map(InvoiceListItemResponse::getInvoiceNumber)
                .toList());
        assertEquals(List.of("DEPOSEE", "EXTRAITE", "VALIDEE"), ascendingStatuses.getContent().stream()
                .map(InvoiceListItemResponse::getStatus)
                .toList());
    }

    private void assertSearchReturnsInvoice(Invoice expectedInvoice, String supplier, String client) {
        assertEquals(
                List.of(expectedInvoice.getInvoiceId()),
                invoiceService.searchInvoices(
                                null, supplier, client, null, null, null, null, null, Pageable.unpaged())
                        .map(InvoiceListItemResponse::getInvoiceId)
                        .getContent()
        );
    }

    private Organization createOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("Other organization");
        organization.setLegalName("Other organization SAS");
        organization.setSiret("99999999999999");
        organization.setEmail("other-organization@example.com");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        return organizationRepository.save(organization);
    }

    private User createUser(Organization organization) {
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findById(1L).orElseThrow());
        user.setFirstName("Other");
        user.setLastName("User");
        user.setEmail("other-user@example.com");
        user.setPasswordHash("not-used");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private Supplier createSupplier(Organization organization, String name, String siret) {
        LocalDateTime now = LocalDateTime.now();
        Supplier supplier = new Supplier();
        supplier.setOrganization(organization);
        supplier.setName(name);
        supplier.setLegalName(name + " SAS");
        supplier.setSiret(siret);
        supplier.setCreatedAt(now);
        supplier.setUpdatedAt(now);
        return supplierRepository.save(supplier);
    }

    private Invoice createInvoice(
            Organization organization,
            User user,
            Supplier supplier,
            String invoiceNumber
    ) {
        LocalDateTime now = LocalDateTime.now();
        InvoiceStatus status = invoiceStatusRepository.findByCode("EXTRAITE").orElseThrow();
        Invoice invoice = new Invoice();
        invoice.setOrganization(organization);
        invoice.setSupplier(supplier);
        invoice.setInvoiceStatus(status);
        invoice.setCreatedByUser(user);
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setInvoiceDate(LocalDate.of(2026, 8, 23));
        invoice.setCurrencyCode("EUR");
        invoice.setTotalHt(new BigDecimal("100.00"));
        invoice.setTotalTva(new BigDecimal("20.00"));
        invoice.setTotalTtc(new BigDecimal("120.00"));
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);
        return invoiceRepository.save(invoice);
    }
}
