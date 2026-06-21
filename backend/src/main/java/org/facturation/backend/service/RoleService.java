package org.facturation.backend.service;

import org.facturation.backend.model.Role;

import java.util.List;
import java.util.Optional;

public interface RoleService {

    List<Role> findAll();

    Optional<Role> findById(Long id);

    Role save(Role role);
}
