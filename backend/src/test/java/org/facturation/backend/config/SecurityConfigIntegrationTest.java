package org.facturation.backend.config;

import org.junit.jupiter.api.Test;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import java.time.Duration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
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
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidJwtIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/999999")
                        .header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredJwtIsRejected() throws Exception {
        var user = userRepository.findById(1L).orElseThrow();
        String expiredToken = new JwtTokenService(jwtSecret, Duration.ofSeconds(-1)).generate(user);

        mockMvc.perform(get("/api/v1/invoices/999999")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
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
                    .andExpect(status().isUnauthorized());
        } finally {
            user.setActive(true);
            userRepository.saveAndFlush(user);
        }
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
}
