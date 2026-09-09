package org.facturation.backend.controller;

import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.Customer;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.CustomerRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@Sql(statements = "ALTER TABLE customers ALTER COLUMN customer_id RESTART WITH 1000")
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class CustomerControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final CustomerRepository customerRepository;
    private final OrganizationRepository organizationRepository;

    @Autowired
    CustomerControllerIntegrationTest(
            CustomerController customerController,
            ApiExceptionHandler apiExceptionHandler,
            CustomerRepository customerRepository,
            OrganizationRepository organizationRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(customerController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.customerRepository = customerRepository;
        this.organizationRepository = organizationRepository;
    }

    @Test
    void createsAnActiveCustomerWithNormalizedLegalIdentifiers() throws Exception {
        mockMvc.perform(post("/api/v1/customers")
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": " Acme France ",
                                  "legalName": " Acme France SAS ",
                                  "siret": "380 129 866 00014",
                                  "vatNumber": "fr89 380129866",
                                  "email": "billing@acme.example"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Acme France"))
                .andExpect(jsonPath("$.legalName").value("Acme France SAS"))
                .andExpect(jsonPath("$.siret").value("38012986600014"))
                .andExpect(jsonPath("$.vatNumber").value("FR89380129866"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void rejectsInvalidOrInconsistentFrenchLegalIdentifiers() throws Exception {
        mockMvc.perform(post("/api/v1/customers")
                        .contentType("application/json")
                        .content("""
                                {"name":"Invalid","legalName":"Invalid SAS","siret":"12345678901234"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CUSTOMER_VALIDATION_ERROR"));

        mockMvc.perform(post("/api/v1/customers")
                        .contentType("application/json")
                        .content("""
                                {"name":"Mismatch","legalName":"Mismatch SAS","siret":"38012986600014","vatNumber":"FR40303265045"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CUSTOMER_VALIDATION_ERROR"));
    }

    @Test
    void rejectsDuplicateLegalIdentifiersWithinCurrentOrganization() throws Exception {
        createCustomer("Existing", "Existing SAS", "38012986600014", "FR89380129866");

        mockMvc.perform(post("/api/v1/customers")
                        .contentType("application/json")
                        .content("""
                                {"name":"Duplicate","legalName":"Duplicate SAS","siret":"38012986600014"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CUSTOMER_LEGAL_IDENTIFIER_CONFLICT"));
    }

    @Test
    void listsAndRetrievesOnlyCustomersFromCurrentOrganization() throws Exception {
        Customer visible = createCustomer("Visible", "Visible SAS", null, null);
        Customer hidden = customer(createOrganization("hidden"), "Hidden", "Hidden SAS", null, null);

        mockMvc.perform(get("/api/v1/customers").param("page", "0").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].customerId", hasItem(visible.getCustomerId().intValue())))
                .andExpect(jsonPath("$.content[*].customerId", not(hasItem(hidden.getCustomerId().intValue()))));

        mockMvc.perform(get("/api/v1/customers/{id}", hidden.getCustomerId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_FOUND"));
    }

    @Test
    void updatesAndDeactivatesCustomerWithoutDeletingIt() throws Exception {
        Customer customer = createCustomer("Before", "Before SAS", "38012986600014", "FR89380129866");

        mockMvc.perform(patch("/api/v1/customers/{id}", customer.getCustomerId())
                        .contentType("application/json")
                        .content("""
                                {"name":"After","phone":" 01 02 03 04 05 "}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("After"))
                .andExpect(jsonPath("$.phone").value("01 02 03 04 05"));

        mockMvc.perform(post("/api/v1/customers/{id}/deactivate", customer.getCustomerId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        Customer storedCustomer = customerRepository.findById(customer.getCustomerId()).orElseThrow();
        assertFalse(storedCustomer.isActive());
    }

    @Test
    void allowsTheSameLegalIdentifierInAnotherOrganization() {
        Customer customer = customer(
                createOrganization("other"),
                "Other",
                "Other SAS",
                "38012986600014",
                "FR89380129866"
        );

        assertNotNull(customer.getCustomerId());
    }

    @Test
    void databaseEnforcesLegalIdentifierUniquenessWithinOrganization() {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        customer(organization, "First", "First SAS", "38012986600014", null);
        Customer duplicate = new Customer();
        duplicate.setOrganization(organization);
        duplicate.setName("Duplicate");
        duplicate.setLegalName("Duplicate SAS");
        duplicate.setSiret("38012986600014");
        duplicate.setActive(true);
        duplicate.setCreatedAt(LocalDateTime.now());
        duplicate.setUpdatedAt(LocalDateTime.now());

        assertThrows(DataIntegrityViolationException.class, () -> customerRepository.saveAndFlush(duplicate));
    }

    private Customer createCustomer(String name, String legalName, String siret, String vatNumber) {
        return customer(organizationRepository.findById(1L).orElseThrow(), name, legalName, siret, vatNumber);
    }

    private Customer customer(Organization organization, String name, String legalName, String siret, String vatNumber) {
        Customer customer = new Customer();
        customer.setOrganization(organization);
        customer.setName(name);
        customer.setLegalName(legalName);
        customer.setSiret(siret);
        customer.setVatNumber(vatNumber);
        customer.setActive(true);
        customer.setCreatedAt(LocalDateTime.now());
        customer.setUpdatedAt(LocalDateTime.now());
        return customerRepository.saveAndFlush(customer);
    }

    private Organization createOrganization(String suffix) {
        Organization organization = new Organization();
        organization.setName("Organization " + suffix);
        organization.setLegalName("Organization " + suffix + " SAS");
        organization.setSiret(uniqueDigits());
        organization.setEmail(suffix + "@example.com");
        organization.setCreatedAt(LocalDateTime.now());
        organization.setUpdatedAt(LocalDateTime.now());
        return organizationRepository.saveAndFlush(organization);
    }

    private String uniqueDigits() {
        String value = Long.toString(System.nanoTime());
        return value.substring(Math.max(0, value.length() - 14));
    }
}
