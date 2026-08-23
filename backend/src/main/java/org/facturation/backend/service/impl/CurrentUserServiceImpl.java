package org.facturation.backend.service.impl;

import org.facturation.backend.model.User;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.UserService;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserServiceImpl implements CurrentUserService {

    private final UserService userService;

    public CurrentUserServiceImpl(UserService userService) {
        this.userService = userService;
    }

    @Override
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AuthenticationCredentialsNotFoundException("Authentication is required");
        }
        return userService.findByEmail(authentication.getName());
    }
}
