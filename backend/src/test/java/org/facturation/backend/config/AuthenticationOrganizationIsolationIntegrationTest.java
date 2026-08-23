package org.facturation.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "ALTER TABLE organizations ALTER COLUMN organization_id RESTART WITH 1000",
        "ALTER TABLE users ALTER COLUMN user_id RESTART WITH 1000",
        "ALTER TABLE suppliers ALTER COLUMN supplier_id RESTART WITH 1000"
})
class AuthenticationOrganizationIsolationIntegrationTest {

    private static final String PASSWORD = "organization-test-password";

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Supplier firstOrganizationSupplier;
    private Supplier secondOrganizationSupplier;
    private String firstOrganizationToken;
    private String secondOrganizationToken;

    @BeforeEach
    void setUpOrganizations() throws Exception {
        Organization firstOrganization = createOrganization(
                "Security organization one",
                "11111111111111",
                "security-one@example.com"
        );
        Organization secondOrganization = createOrganization(
                "Security organization two",
                "22222222222222",
                "security-two@example.com"
        );

        createUser(firstOrganization, "security-user-one@example.com");
        createUser(secondOrganization, "security-user-two@example.com");
        firstOrganizationSupplier = createSupplier(firstOrganization, "Visible only to organization one");
        secondOrganizationSupplier = createSupplier(secondOrganization, "Visible only to organization two");

        firstOrganizationToken = login("security-user-one@example.com");
        secondOrganizationToken = login("security-user-two@example.com");
    }

    @Test
    void authenticatedUsersOnlyListDataFromTheirOrganization() throws Exception {
        mockMvc.perform(get("/api/v1/suppliers")
                        .header("Authorization", "Bearer " + firstOrganizationToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].supplierId", hasItem(
                        firstOrganizationSupplier.getSupplierId().intValue()
                )))
                .andExpect(jsonPath("$.content[*].supplierId", not(hasItem(
                        secondOrganizationSupplier.getSupplierId().intValue()
                ))));

        mockMvc.perform(get("/api/v1/suppliers")
                        .header("Authorization", "Bearer " + secondOrganizationToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].supplierId", hasItem(
                        secondOrganizationSupplier.getSupplierId().intValue()
                )))
                .andExpect(jsonPath("$.content[*].supplierId", not(hasItem(
                        firstOrganizationSupplier.getSupplierId().intValue()
                ))));
    }

    @Test
    void authenticatedUsersCannotAccessAnotherOrganizationsResource() throws Exception {
        mockMvc.perform(get("/api/v1/suppliers/{id}", secondOrganizationSupplier.getSupplierId())
                        .header("Authorization", "Bearer " + firstOrganizationToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SUPPLIER_NOT_FOUND"));

        mockMvc.perform(get("/api/v1/suppliers/{id}", firstOrganizationSupplier.getSupplierId())
                        .header("Authorization", "Bearer " + secondOrganizationToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SUPPLIER_NOT_FOUND"));
    }

    private Organization createOrganization(String name, String siret, String email) {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName(name);
        organization.setLegalName(name + " SAS");
        organization.setSiret(siret);
        organization.setEmail(email);
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        return organizationRepository.save(organization);
    }

    private void createUser(Organization organization, String email) {
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findById(1L).orElseThrow());
        user.setFirstName("Security");
        user.setLastName("User");
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);
    }

    private Supplier createSupplier(Organization organization, String name) {
        LocalDateTime now = LocalDateTime.now();
        Supplier supplier = new Supplier();
        supplier.setOrganization(organization);
        supplier.setName(name);
        supplier.setLegalName(name + " SAS");
        supplier.setCreatedAt(now);
        supplier.setUpdatedAt(now);
        return supplierRepository.save(supplier);
    }

    private String login(String email) throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private record LoginPayload(String email, String password) {
    }
}
