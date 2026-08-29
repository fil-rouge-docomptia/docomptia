package org.facturation.backend.config;

import org.junit.jupiter.api.Test;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.jdbc.Sql;

import java.time.Duration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Sql(executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS, statements = {
        "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                + "is_active, created_at, updated_at) VALUES (900, 1, 2, 'Operator', 'Security', "
                + "'operator-security@facturation-demo.fr', "
                + "'$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', true, "
                + "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                + "is_active, created_at, updated_at) VALUES (901, 1, 3, 'Manager', 'Security', "
                + "'manager-security@facturation-demo.fr', "
                + "'$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', true, "
                + "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
})
class SecurityConfigIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void publicRouteRemainsAccessibleWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/hello"))
                .andExpect(status().isOk())
                .andExpect(content().string("Hello World"));
    }

    @Test
    void developmentFrontendCanPreflightProtectedRoutes() throws Exception {
        mockMvc.perform(options("/api/v1/users/me")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, HttpHeaders.AUTHORIZATION))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173"
                ));
    }

    @Test
    void unknownOriginCannotPreflightProtectedRoutes() throws Exception {
        mockMvc.perform(options("/api/v1/users/me")
                        .header(HttpHeaders.ORIGIN, "https://untrusted.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void businessRouteRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/1"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Authentication is required"));
    }

    @Test
    void validJwtReachesBusinessRoute() throws Exception {
        String token = loginAndGetToken();

        mockMvc.perform(get("/api/v1/invoices/999999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void httpBasicDoesNotAuthenticateProtectedRoute() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/999999")
                        .header("Authorization", "Basic YWRtaW5AZmFjdHVyYXRpb24tZGVtby5mcjphZG1pbjEyMw=="))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Authentication is required"));
    }

    @Test
    void invalidJwtIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/999999")
                        .header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Authentication is required"));
    }

    @Test
    void expiredJwtIsRejected() throws Exception {
        var user = userRepository.findById(1L).orElseThrow();
        String expiredToken = new JwtTokenService(jwtSecret, Duration.ofSeconds(-1)).generate(user);

        mockMvc.perform(get("/api/v1/invoices/999999")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Authentication is required"));
    }

    @Test
    void inactiveUserJwtIsRejected() throws Exception {
        String token = loginAndGetToken();
        var user = userRepository.findById(1L).orElseThrow();
        user.setActive(false);
        userRepository.saveAndFlush(user);

        try {
            mockMvc.perform(get("/api/v1/invoices/999999")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                    .andExpect(jsonPath("$.message").value("Authentication is required"));
        } finally {
            user.setActive(true);
            userRepository.saveAndFlush(user);
        }
    }

    @Test
    void authenticatedUserWithoutAdminRoleReceivesCommonForbiddenError() throws Exception {
        String token = tokenFor("operator-security@facturation-demo.fr");

        mockMvc.perform(patch("/api/v1/accounting-rules/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Access is denied"));
    }

    @Test
    void onboardingStatusIsRestrictedToAdministrators() throws Exception {
        String token = tokenFor("operator-security@facturation-demo.fr");

        mockMvc.perform(get("/api/v1/organizations/current/onboarding")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void validationPreferencesCanBeReadByOperatorsButOnlyUpdatedByAdministrators() throws Exception {
        String token = tokenFor("operator-security@facturation-demo.fr");

        mockMvc.perform(get("/api/v1/organizations/current/validation-preferences")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/organizations/current/validation-preferences")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"validationRequired\":false}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void operatorCanProcessInvoicesButCannotValidateThem() throws Exception {
        String token = tokenFor("operator-security@facturation-demo.fr");

        mockMvc.perform(patch("/api/v1/invoices/999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"invoiceNumber\":\"INV-001\"}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/invoices/999999/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void accountingManagerCanValidateInvoicesButCannotProcessThem() throws Exception {
        String token = tokenFor("manager-security@facturation-demo.fr");

        mockMvc.perform(post("/api/v1/invoices/999999/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch("/api/v1/invoices/999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"invoiceNumber\":\"INV-001\"}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void authenticatedRequestToUnmappedBusinessRouteIsDenied() throws Exception {
        mockMvc.perform(get("/api/v1/unmapped")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void userListRequiresAdminRole() throws Exception {
        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer " + tokenFor(
                                "operator-security@facturation-demo.fr"
                        )))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void userInvitationRequiresAdminRole() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Blocked",
                                  "lastName": "Invitation",
                                  "email": "blocked-invitation@example.com",
                                  "roleCode": "OPERATEUR_COMPTABLE"
                                }
                                """)
                        .header("Authorization", "Bearer " + tokenFor(
                                "operator-security@facturation-demo.fr"
                        )))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void userUpdateRequiresAdminRole() throws Exception {
        mockMvc.perform(patch("/api/v1/users/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Blocked\"}")
                        .header("Authorization", "Bearer " + tokenFor(
                                "operator-security@facturation-demo.fr"
                        )))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    private String loginAndGetToken() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@facturation-demo.fr","password":"admin123"}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("token").asText();
    }

    private String tokenFor(String email) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findByEmailIgnoreCase(email).orElseThrow()
        );
    }
}
