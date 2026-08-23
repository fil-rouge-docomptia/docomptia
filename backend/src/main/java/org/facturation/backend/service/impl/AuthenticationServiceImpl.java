package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.LoginRequest;
import org.facturation.backend.dto.response.LoginResponse;
import org.facturation.backend.exception.InvalidLoginException;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.AuthenticationService;
import org.facturation.backend.service.JwtTokenService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticationServiceImpl implements AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtTokenService jwtTokenService;

    public AuthenticationServiceImpl(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            JwtTokenService jwtTokenService
    ) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.jwtTokenService = jwtTokenService;
    }

    @Override
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        if (request == null || isBlank(request.getEmail()) || isBlank(request.getPassword())) {
            throw new InvalidLoginException();
        }

        String email = request.getEmail().trim();
        try {
            authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, request.getPassword())
            );
        } catch (AuthenticationException exception) {
            throw new InvalidLoginException();
        }

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(InvalidLoginException::new);
        return new LoginResponse(
                user.getUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole().getCode(),
                user.getOrganization().getOrganizationId(),
                jwtTokenService.generate(user)
        );
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
