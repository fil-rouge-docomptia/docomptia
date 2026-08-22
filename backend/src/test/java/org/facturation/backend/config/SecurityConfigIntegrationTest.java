package org.facturation.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

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
    void authenticatedRequestReachesBusinessRoute() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/999999")
                        .with(user("security-test-user").roles("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void loginComparesRawPasswordWithStoredHash() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/999999")
                        .with(httpBasic("admin@facturation-demo.fr", "admin123")))
                .andExpect(status().isNotFound());
    }

    @Test
    void loginRejectsInvalidPassword() throws Exception {
        mockMvc.perform(get("/api/v1/invoices/999999")
                        .with(httpBasic("admin@facturation-demo.fr", "wrong-password")))
                .andExpect(status().isUnauthorized());
    }
}
