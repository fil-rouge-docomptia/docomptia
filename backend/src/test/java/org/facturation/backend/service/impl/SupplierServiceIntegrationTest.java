package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.exception.InvalidSupplierException;
import org.facturation.backend.exception.SupplierLegalIdentifierConflictException;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.service.SupplierService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
@Sql(statements = {
        "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 1000",
        "ALTER TABLE suppliers ALTER COLUMN supplier_id RESTART WITH 1000"
})
class SupplierServiceIntegrationTest {

    private final SupplierService supplierService;
    private final SupplierRepository supplierRepository;
    private final OrganizationRepository organizationRepository;

    @Autowired
    SupplierServiceIntegrationTest(
            SupplierService supplierService,
            SupplierRepository supplierRepository,
            OrganizationRepository organizationRepository
    ) {
        this.supplierService = supplierService;
        this.supplierRepository = supplierRepository;
        this.organizationRepository = organizationRepository;
    }

    @Test
    void findsSupplierBySiretBeforeVatNumber() {
        Organization organization = createOrganization("priority");
        Supplier supplierBySiret = createSupplier(
                organization,
                "Siret supplier",
                "38012986600014",
                "FR11111111111"
        );
        createSupplier(organization, "VAT supplier", "11111111111111", "FR89380129866");

        Optional<Supplier> result = supplierService.findByLegalIdentifiers(
                organization,
                "38012986600014",
                "FR89380129866"
        );

        assertEquals(supplierBySiret.getSupplierId(), result.orElseThrow().getSupplierId());
    }

    @Test
    void fallsBackToVatNumberWithinCurrentOrganization() {
        Organization currentOrganization = createOrganization("current");
        Organization otherOrganization = createOrganization("other");
        Supplier supplierByVat = createSupplier(
                currentOrganization,
                "Current organization supplier",
                "11111111111111",
                "FR89380129866"
        );
        createSupplier(otherOrganization, "Other organization supplier", "38012986600014", "FR89380129866");

        Optional<Supplier> result = supplierService.findByLegalIdentifiers(
                currentOrganization,
                "38012986600014",
                "fr89380129866"
        );

        assertEquals(supplierByVat.getSupplierId(), result.orElseThrow().getSupplierId());
    }

    @Test
    void returnsEmptyWhenNoLegalIdentifierMatches() {
        Organization organization = createOrganization("no-match");

        Optional<Supplier> result = supplierService.findByLegalIdentifiers(
                organization,
                "38012986600014",
                "FR89380129866"
        );

        assertTrue(result.isEmpty());
    }

    @Test
    void resolvesInvoiceSupplierByLegalIdentifierBeforeName() {
        Organization organization = createOrganization("invoice-resolution");
        Supplier supplierBySiret = createSupplier(
                organization,
                "Legal identifier supplier",
                "38012986600014",
                "FR11111111111"
        );
        createSupplier(organization, "OCR supplier name", "11111111111111", "FR22222222222");
        OcrAnalysisResponse ocrAnalysis = new OcrAnalysisResponse();
        ocrAnalysis.setFields(List.of(
                ocrField("supplierName", "OCR supplier name"),
                ocrField("siret", "38012986600014")
        ));

        Supplier result = supplierService.resolveForInvoiceUpload(null, organization, ocrAnalysis);

        assertEquals(supplierBySiret.getSupplierId(), result.getSupplierId());
    }

    @Test
    void createsSupplierWhenNameAndLegalIdentifierAreExtracted() {
        Organization organization = createOrganization("automatic-creation");
        long supplierCountBefore = supplierRepository.count();
        OcrAnalysisResponse ocrAnalysis = new OcrAnalysisResponse();
        ocrAnalysis.setFields(List.of(
                ocrField("supplierName", "New supplier"),
                ocrField("siret", "38012986600014")
        ));

        Supplier result = supplierService.resolveForInvoiceUpload(null, organization, ocrAnalysis);

        assertNotNull(result);
        assertEquals("New supplier", result.getName());
        assertEquals("38012986600014", result.getSiret());
        assertEquals(supplierCountBefore + 1, supplierRepository.count());
    }

    @Test
    void rejectsAutomaticCreationWithInvalidSiret() {
        Organization organization = createOrganization("invalid-automatic-creation");
        OcrAnalysisResponse ocrAnalysis = new OcrAnalysisResponse();
        ocrAnalysis.setFields(List.of(
                ocrField("supplierName", "Invalid supplier"),
                ocrField("siret", "38012986600015")
        ));

        InvalidSupplierException exception = assertThrows(
                InvalidSupplierException.class,
                () -> supplierService.resolveForInvoiceUpload(null, organization, ocrAnalysis)
        );

        assertEquals("siret must be a valid French SIRET", exception.getMessage());
    }

    @Test
    void rejectsAutomaticCreationWithInconsistentLegalIdentifiers() {
        Organization organization = createOrganization("inconsistent-automatic-creation");
        OcrAnalysisResponse ocrAnalysis = new OcrAnalysisResponse();
        ocrAnalysis.setFields(List.of(
                ocrField("supplierName", "Inconsistent supplier"),
                ocrField("siret", "73282932000074"),
                ocrField("vatNumber", "FR89380129866")
        ));

        InvalidSupplierException exception = assertThrows(
                InvalidSupplierException.class,
                () -> supplierService.resolveForInvoiceUpload(null, organization, ocrAnalysis)
        );

        assertEquals(
                "vatNumber must refer to the same company as the other legal identifier",
                exception.getMessage()
        );
    }

    @Test
    void doesNotCreateSupplierFromNameAlone() {
        Organization organization = createOrganization("name-only");
        long supplierCountBefore = supplierRepository.count();
        OcrAnalysisResponse ocrAnalysis = new OcrAnalysisResponse();
        ocrAnalysis.setFields(List.of(ocrField("supplierName", "Uncertain supplier")));

        Supplier result = supplierService.resolveForInvoiceUpload(null, organization, ocrAnalysis);

        assertNull(result);
        assertEquals(supplierCountBefore, supplierRepository.count());
    }

    @Test
    void doesNotCreateSupplierFromLegalIdentifierWithoutName() {
        Organization organization = createOrganization("identifier-only");
        long supplierCountBefore = supplierRepository.count();
        OcrAnalysisResponse ocrAnalysis = new OcrAnalysisResponse();
        ocrAnalysis.setFields(List.of(ocrField("vatNumber", "FR89380129866")));

        Supplier result = supplierService.resolveForInvoiceUpload(null, organization, ocrAnalysis);

        assertNull(result);
        assertEquals(supplierCountBefore, supplierRepository.count());
    }

    @Test
    void reusesExistingSupplierByNameInsteadOfCreatingOne() {
        Organization organization = createOrganization("existing-name");
        Supplier existingSupplier = createSupplier(organization, "Existing supplier", null, null);
        long supplierCountBefore = supplierRepository.count();
        OcrAnalysisResponse ocrAnalysis = new OcrAnalysisResponse();
        ocrAnalysis.setFields(List.of(
                ocrField("supplierName", "Existing supplier"),
                ocrField("vatNumber", "FR89380129866")
        ));

        Supplier result = supplierService.resolveForInvoiceUpload(null, organization, ocrAnalysis);

        assertEquals(existingSupplier.getSupplierId(), result.getSupplierId());
        assertEquals("FR89380129866", result.getVatNumber());
        assertEquals(supplierCountBefore, supplierRepository.count());
    }

    @Test
    void returnsBusinessErrorWhenDatabaseRejectsDuplicateSiret() {
        Organization organization = createOrganization("duplicate-siret-business-error");
        createSupplier(organization, "First supplier", "38012986600014", null);
        Supplier duplicate = supplier(organization, "Second supplier", "38012986600014", null);

        SupplierLegalIdentifierConflictException exception = assertThrows(
                SupplierLegalIdentifierConflictException.class,
                () -> supplierService.save(duplicate)
        );

        assertEquals(
                "Another supplier in the organization already uses this siret",
                exception.getMessage()
        );
    }

    @Test
    void databaseRejectsDuplicateSiretWithinOrganization() {
        Organization organization = createOrganization("duplicate-siret-database");
        createSupplier(organization, "First database supplier", "38012986600014", null);
        Supplier duplicate = supplier(organization, "Second database supplier", "38012986600014", null);

        assertThrows(DataIntegrityViolationException.class, () -> supplierRepository.saveAndFlush(duplicate));
    }

    @Test
    void databaseAllowsSameSiretInDifferentOrganizations() {
        Organization firstOrganization = createOrganization("same-siret-first-organization");
        Organization secondOrganization = createOrganization("same-siret-second-organization");

        createSupplier(firstOrganization, "First organization supplier", "38012986600014", null);
        Supplier secondSupplier = createSupplier(
                secondOrganization,
                "Second organization supplier",
                "38012986600014",
                null
        );

        assertNotNull(secondSupplier.getSupplierId());
    }

    private Organization createOrganization(String suffix) {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("Organization " + suffix);
        organization.setLegalName("Organization " + suffix + " SAS");
        organization.setSiret(uniqueDigits());
        organization.setEmail(suffix + "@example.com");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        return organizationRepository.save(organization);
    }

    private Supplier createSupplier(
            Organization organization,
            String name,
            String siret,
            String vatNumber
    ) {
        return supplierRepository.save(supplier(organization, name, siret, vatNumber));
    }

    private Supplier supplier(
            Organization organization,
            String name,
            String siret,
            String vatNumber
    ) {
        LocalDateTime now = LocalDateTime.now();
        Supplier supplier = new Supplier();
        supplier.setOrganization(organization);
        supplier.setName(name);
        supplier.setLegalName(name + " SAS");
        supplier.setSiret(siret);
        supplier.setVatNumber(vatNumber);
        supplier.setCreatedAt(now);
        supplier.setUpdatedAt(now);
        return supplier;
    }

    private String uniqueDigits() {
        String value = Long.toString(System.nanoTime());
        return value.substring(Math.max(0, value.length() - 14));
    }

    private OcrFieldResponse ocrField(String fieldName, String normalizedValue) {
        OcrFieldResponse field = new OcrFieldResponse();
        field.setFieldName(fieldName);
        field.setNormalizedValue(normalizedValue);
        return field;
    }
}
