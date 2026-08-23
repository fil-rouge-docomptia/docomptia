package org.facturation.backend.service.impl;

import org.facturation.backend.model.User;
import org.facturation.backend.dto.response.UserListItemResponse;
import org.facturation.backend.mapper.UserResponseMapper;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.UserService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserResponseMapper userResponseMapper;

    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            UserResponseMapper userResponseMapper
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userResponseMapper = userResponseMapper;
    }

    @Override
    public List<User> findAll() {
        return userRepository.findAll();
    }

    @Override
    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }

    @Override
    public User findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("Authenticated user not found"));
    }

    @Override
    public User save(User user) {
        if (!isBcryptHash(user.getPasswordHash())) {
            user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        }
        return userRepository.save(user);
    }

    @Override
    public User changePassword(Long id, String rawPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        return userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserListItemResponse> findPageForOrganization(Long organizationId, Pageable pageable) {
        return userRepository.findByOrganizationOrganizationId(organizationId, pageable)
                .map(userResponseMapper::toListItemResponse);
    }

    private boolean isBcryptHash(String password) {
        return password != null && password.matches("^\\$2[ayb]\\$.{56}$");
    }
}
