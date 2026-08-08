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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@Sql(statements = {
        "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 1000",
        "ALTER TABLE suppliers ALTER COLUMN supplier_id RESTART WITH 1000"
})
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
