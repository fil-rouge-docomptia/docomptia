package org.facturation.backend.service;

import org.facturation.backend.model.User;

import java.util.List;
import java.util.Optional;

public interface UserService {

    List<User> findAll();

    Optional<User> findById(Long id);

    User findByEmail(String email);

    User save(User user);

    User changePassword(Long id, String rawPassword);
}
