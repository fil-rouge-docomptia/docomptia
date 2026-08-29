package org.facturation.backend.controller;

import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, "
        + "password_hash, is_active, created_at, updated_at) VALUES (9670, 1, 2, 'Test', 'Operator', "
        + "'role-operator@example.com', 'not-returned', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
class RoleControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void adminListsAvailableRolesWithCodeAndLabel() throws Exception {
        mockMvc.perform(get("/api/v1/roles")
                        .header("Authorization", "Bearer " + tokenFor("admin@facturation-demo.fr")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].code").value("ADMIN"))
                .andExpect(jsonPath("$[0].label").value("Administrateur"))
                .andExpect(jsonPath("$[1].code").value("OPERATEUR_COMPTABLE"))
                .andExpect(jsonPath("$[1].label").value("Operateur comptable"))
                .andExpect(jsonPath("$[2].code").value("RESPONSABLE_COMPTABLE"))
                .andExpect(jsonPath("$[2].label").value("Responsable comptable"))
                .andExpect(jsonPath("$[0].id").doesNotExist())
                .andExpect(jsonPath("$[0].description").doesNotExist());
    }

    @Test
    void nonAdminCannotListRoles() throws Exception {
        mockMvc.perform(get("/api/v1/roles")
                        .header("Authorization", "Bearer " + tokenFor("role-operator@example.com")))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedUserCannotListRoles() throws Exception {
        mockMvc.perform(get("/api/v1/roles"))
                .andExpect(status().isUnauthorized());
    }

    private String tokenFor(String email) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findByEmailIgnoreCase(email).orElseThrow()
        );
    }
}
