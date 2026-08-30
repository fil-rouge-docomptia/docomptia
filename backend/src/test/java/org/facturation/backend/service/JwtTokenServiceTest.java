package org.facturation.backend.service;

import org.facturation.backend.model.User;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtTokenServiceTest {

    private static final String SECRET = "test-jwt-secret";

    @Test
    void validatesSignedUnexpiredToken() {
        JwtTokenService service = new JwtTokenService(SECRET, Duration.ofMinutes(5));

        assertEquals(42L, service.validate(service.generate(user(42L))).orElseThrow());
    }

    @Test
    void rejectsTokenWithModifiedSignature() {
        JwtTokenService service = new JwtTokenService(SECRET, Duration.ofMinutes(5));
        String token = service.generate(user(42L));
        String modifiedToken = corruptSignature(token);

        assertTrue(service.validate(modifiedToken).isEmpty());
    }

    @Test
    void rejectsExpiredToken() {
        JwtTokenService service = new JwtTokenService(SECRET, Duration.ofSeconds(-1));

        assertTrue(service.validate(service.generate(user(42L))).isEmpty());
    }

    private User user(Long id) {
        User user = new User();
        user.setUserId(id);
        return user;
    }

    private String corruptSignature(String token) {
        String[] parts = token.split("\\.", -1);
        byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
        signature[0] = (byte) (signature[0] ^ 0x01);
        parts[2] = Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        return String.join(".", parts);
    }
}
