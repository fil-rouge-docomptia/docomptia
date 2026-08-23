package org.facturation.backend.controller;

import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "INSERT INTO organizations (organization_id, name, legal_name, siret, email, created_at, updated_at) "
                + "VALUES (9630, 'Other organization', 'Other organization SAS', '99999999999999', "
                + "'other-users@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                + "is_active, created_at, updated_at) VALUES (9631, 1, 2, 'Zoe', 'Accountant', "
                + "'zoe-accountant@example.com', 'not-returned', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                + "is_active, created_at, updated_at) VALUES (9632, 9630, 1, 'Hidden', 'User', "
                + "'hidden-user@example.com', 'not-returned', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
})
class UserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void returnsSortedPageWithoutSensitiveDataForCurrentOrganization() throws Exception {
        long expectedUsers = userRepository.findAll().stream()
                .filter(user -> user.getOrganization().getOrganizationId().equals(1L))
                .count();

        mockMvc.perform(get("/api/v1/users")
                        .param("page", "0")
                        .param("size", "1")
                        .param("sortBy", "firstName")
                        .param("direction", "DESC")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].firstName").value("Zoe"))
                .andExpect(jsonPath("$.content[0].lastName").value("Accountant"))
                .andExpect(jsonPath("$.content[0].email").value("zoe-accountant@example.com"))
                .andExpect(jsonPath("$.content[0].role.code").value("OPERATEUR_COMPTABLE"))
                .andExpect(jsonPath("$.content[0].active").value(false))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.content[0].organization").doesNotExist())
                .andExpect(jsonPath("$.totalElements").value(expectedUsers))
                .andExpect(jsonPath("$.totalPages").value(expectedUsers))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(1));

        mockMvc.perform(get("/api/v1/users")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].email", not(hasItem("hidden-user@example.com"))));
    }

    @Test
    void adminInvitesInactiveUserInCurrentOrganization() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": " Marie ",
                                  "lastName": " Martin ",
                                  "email": " MARIE.MARTIN@Example.com ",
                                  "roleCode": "OPERATEUR_COMPTABLE"
                                }
                                """)
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.firstName").value("Marie"))
                .andExpect(jsonPath("$.lastName").value("Martin"))
                .andExpect(jsonPath("$.email").value("marie.martin@example.com"))
                .andExpect(jsonPath("$.role.code").value("OPERATEUR_COMPTABLE"))
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.organization").doesNotExist());

        var invitedUser = userRepository.findByEmailIgnoreCase("marie.martin@example.com").orElseThrow();
        assertThat(invitedUser.getOrganization().getOrganizationId()).isEqualTo(1L);
        assertThat(invitedUser.getPasswordHash()).startsWith("$2");
    }

    @Test
    void rejectsEmailAlreadyUsedRegardlessOfCase() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Other",
                                  "lastName": "Admin",
                                  "email": "ADMIN@FACTURATION-DEMO.FR",
                                  "roleCode": "ADMIN"
                                }
                                """)
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_EMAIL_CONFLICT"));
    }

    @Test
    void rejectsRoleOutsideMvpRoles() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Invalid",
                                  "lastName": "Role",
                                  "email": "invalid-role@example.com",
                                  "roleCode": "SUPER_ADMIN"
                                }
                                """)
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USER_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("roleCode is not allowed"));
    }

    private String adminToken() {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow()
        );
    }
}
