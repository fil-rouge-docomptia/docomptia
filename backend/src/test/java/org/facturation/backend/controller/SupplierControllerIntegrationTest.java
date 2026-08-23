package org.facturation.backend.controller;

import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@Sql(statements = {
        "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 1000",
        "ALTER TABLE suppliers ALTER COLUMN supplier_id RESTART WITH 1000"
})
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class SupplierControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final OrganizationRepository organizationRepository;
    private final SupplierRepository supplierRepository;

    @Autowired
    SupplierControllerIntegrationTest(
            SupplierController supplierController,
            ApiExceptionHandler apiExceptionHandler,
            OrganizationRepository organizationRepository,
            SupplierRepository supplierRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(supplierController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.organizationRepository = organizationRepository;
        this.supplierRepository = supplierRepository;
    }

    @Test
    void returnsRequestedPageForCurrentOrganization() throws Exception {
        Organization currentOrganization = organizationRepository.findById(1L).orElseThrow();
        createSupplier(currentOrganization, "Alpha supplier", "11111111111111");
        createSupplier(currentOrganization, "Beta supplier", "22222222222222");

        Organization otherOrganization = createOrganization();
        createSupplier(otherOrganization, "Hidden supplier", "33333333333333");

        mockMvc.perform(get("/api/v1/suppliers").param("page", "0").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].name").value("Alpha supplier"))
                .andExpect(jsonPath("$.content[1].name").value("Beta supplier"))
                .andExpect(jsonPath("$.content[*].name", not(hasItem("Hidden supplier"))))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(2));
    }

    @Test
    void returnsUsefulSupplierDetails() throws Exception {
        mockMvc.perform(get("/api/v1/suppliers/{id}", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supplierId").value(1))
                .andExpect(jsonPath("$.name").value("Orange"))
                .andExpect(jsonPath("$.legalName").value("Orange SA"))
                .andExpect(jsonPath("$.siret").value("38012986600014"))
                .andExpect(jsonPath("$.vatNumber").value("FR89380129866"))
                .andExpect(jsonPath("$.email").value("factures@orange.com"))
                .andExpect(jsonPath("$.phone").value("3900"))
                .andExpect(jsonPath("$.address").isNotEmpty())
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
    }

    @Test
    void hidesSupplierFromAnotherOrganization() throws Exception {
        Organization otherOrganization = createOrganization();
        Supplier hiddenSupplier = createSupplier(otherOrganization, "Hidden supplier", "33333333333333");

        mockMvc.perform(get("/api/v1/suppliers/{id}", hiddenSupplier.getSupplierId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SUPPLIER_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(
                        "Supplier " + hiddenSupplier.getSupplierId() + " not found"
                ));
    }

    @Test
    void updatesAuthorizedSupplierFields() throws Exception {
        mockMvc.perform(patch("/api/v1/suppliers/{id}", 1L)
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "Orange Business",
                                  "legalName": "Orange SA Updated",
                                  "siret": "12345678901234",
                                  "vatNumber": "frab123456789",
                                  "email": "updated@orange.com",
                                  "phone": "0123456789",
                                  "address": "2 avenue de la Republique, Paris"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supplierId").value(1))
                .andExpect(jsonPath("$.name").value("Orange Business"))
                .andExpect(jsonPath("$.legalName").value("Orange SA Updated"))
                .andExpect(jsonPath("$.siret").value("12345678901234"))
                .andExpect(jsonPath("$.vatNumber").value("FRAB123456789"))
                .andExpect(jsonPath("$.email").value("updated@orange.com"))
                .andExpect(jsonPath("$.phone").value("0123456789"))
                .andExpect(jsonPath("$.address").value("2 avenue de la Republique, Paris"));
    }

    @Test
    void rejectsInvalidLegalIdentifier() throws Exception {
        mockMvc.perform(patch("/api/v1/suppliers/{id}", 1L)
                        .contentType("application/json")
                        .content("""
                                {"siret": "1234"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SUPPLIER_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("siret must contain exactly 14 digits"));
    }

    @Test
    void rejectsDuplicateLegalIdentifierWithinCurrentOrganization() throws Exception {
        Organization currentOrganization = organizationRepository.findById(1L).orElseThrow();
        createSupplier(currentOrganization, "Duplicate identifier supplier", "12345678901234");

        mockMvc.perform(patch("/api/v1/suppliers/{id}", 1L)
                        .contentType("application/json")
                        .content("""
                                {"siret": "12345678901234"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SUPPLIER_LEGAL_IDENTIFIER_CONFLICT"))
                .andExpect(jsonPath("$.message").value(
                        "Another supplier in the organization already uses this siret"
                ));
    }

    @Test
    void allowsSameLegalIdentifierInAnotherOrganization() throws Exception {
        Organization otherOrganization = createOrganization();
        createSupplier(otherOrganization, "Other organization supplier", "12345678901234");

        mockMvc.perform(patch("/api/v1/suppliers/{id}", 1L)
                        .contentType("application/json")
                        .content("""
                                {"siret": "12345678901234"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.siret").value("12345678901234"));
    }

    @Test
    void refusesUpdateForSupplierFromAnotherOrganization() throws Exception {
        Organization otherOrganization = createOrganization();
        Supplier hiddenSupplier = createSupplier(otherOrganization, "Hidden update supplier", "12345678901234");

        mockMvc.perform(patch("/api/v1/suppliers/{id}", hiddenSupplier.getSupplierId())
                        .contentType("application/json")
                        .content("""
                                {"phone": "0123456789"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SUPPLIER_NOT_FOUND"));
    }

    @Test
    void rejectsRequestWithoutEffectiveChange() throws Exception {
        mockMvc.perform(patch("/api/v1/suppliers/{id}", 1L)
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("At least one changed field is required"));
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
}
