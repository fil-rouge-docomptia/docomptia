package org.facturation.backend.service;

import org.facturation.backend.model.User;
import org.junit.jupiter.api.Test;

import java.time.Duration;

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
        String modifiedToken = token.substring(0, token.length() - 1)
                + (token.endsWith("x") ? "y" : "x");

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
}
