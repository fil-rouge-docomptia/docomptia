package org.facturation.backend.service;

import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;

import java.util.List;
import java.util.Optional;

public interface RoleService {

    List<Role> findAll();

    Optional<Role> findById(Long id);

    Role findByCode(RoleCode code);

    Role findByCode(String code);

    Role findAssignableRole(String code, Long organizationId);

    Role save(Role role);
}
