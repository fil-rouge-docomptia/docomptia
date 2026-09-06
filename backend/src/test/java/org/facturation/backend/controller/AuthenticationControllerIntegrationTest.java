package org.facturation.backend.controller;

import org.facturation.backend.model.User;
import org.facturation.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@AutoConfigureMockMvc
class AuthenticationControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.validity}")
    private Duration jwtValidity;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void logsInActiveUserWithValidCredentials() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"ADMIN@facturation-demo.fr","password":"admin123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(1))
                .andExpect(jsonPath("$.email").value("admin@facturation-demo.fr"))
                .andExpect(jsonPath("$.firstName").value("Admin"))
                .andExpect(jsonPath("$.lastName").value("Demo"))
                .andExpect(jsonPath("$.role").value("OWNER"))
                .andExpect(jsonPath("$.roles[0].code").value("OWNER"))
                .andExpect(jsonPath("$.permissions[?(@ == 'invoice.read')]").isNotEmpty())
                .andExpect(jsonPath("$.organizationId").value(1))
                .andExpect(result -> assertValidUserToken(
                        objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText()
                ))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    private void assertValidUserToken(String token) throws Exception {
        String[] parts = token.split("\\.");
        assertEquals(3, parts.length);

        Map<String, Object> claims = objectMapper.readValue(
                Base64.getUrlDecoder().decode(parts[1]),
                new TypeReference<>() { }
        );
        assertEquals("1", claims.get("sub"));
        long issuedAt = ((Number) claims.get("iat")).longValue();
        long expiration = ((Number) claims.get("exp")).longValue();
        assertTrue(expiration > Instant.now().getEpochSecond());
        assertEquals(jwtValidity.toSeconds(), expiration - issuedAt);
        assertFalse(claims.containsKey("email"));
        assertFalse(claims.containsKey("password"));
        assertFalse(claims.containsKey("passwordHash"));

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(
                jwtSecret.getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
        ));
        String expectedSignature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal((parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8)));
        assertEquals(expectedSignature, parts[2]);
    }

    @Test
    void rejectsUnknownUser() throws Exception {
        assertInvalidCredentials("unknown@example.com", "admin123");
    }

    @Test
    void rejectsWrongPassword() throws Exception {
        assertInvalidCredentials("admin@facturation-demo.fr", "wrong-password");
    }

    @Test
    void rejectsInactiveUser() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();
        user.setActive(false);
        userRepository.saveAndFlush(user);

        try {
            assertInvalidCredentials("admin@facturation-demo.fr", "admin123");
        } finally {
            user.setActive(true);
            userRepository.saveAndFlush(user);
        }
    }

    private void assertInvalidCredentials(String email, String password) throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }
}
