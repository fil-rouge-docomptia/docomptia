package org.facturation.backend.service.impl;

import org.facturation.backend.model.User;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.mapper.UserResponseMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceImplTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private UserServiceImpl userService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        userService = new UserServiceImpl(userRepository, passwordEncoder, new UserResponseMapper());
    }

    @Test
    void hashesPasswordBeforeSavingUser() {
        User user = new User();
        user.setPasswordHash("plain-password");
        when(userRepository.save(user)).thenReturn(user);

        userService.save(user);

        assertNotEquals("plain-password", user.getPasswordHash());
        assertTrue(passwordEncoder.matches("plain-password", user.getPasswordHash()));
        verify(userRepository).save(user);
    }

    @Test
    void changingPasswordCreatesANewHash() {
        User user = new User();
        String previousHash = passwordEncoder.encode("old-password");
        user.setPasswordHash(previousHash);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        userService.changePassword(1L, "new-password");

        assertNotEquals(previousHash, user.getPasswordHash());
        assertTrue(passwordEncoder.matches("new-password", user.getPasswordHash()));
        assertFalse(passwordEncoder.matches("old-password", user.getPasswordHash()));
    }
}
