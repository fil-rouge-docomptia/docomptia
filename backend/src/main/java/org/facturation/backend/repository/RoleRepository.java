package org.facturation.backend.repository;

import org.facturation.backend.model.Role;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Long> {

    @EntityGraph(attributePaths = "permissions")
    Optional<Role> findByCode(String code);

    @EntityGraph(attributePaths = "permissions")
    Optional<Role> findByCodeAndSystemRoleTrue(String code);

    @EntityGraph(attributePaths = "permissions")
    Optional<Role> findByCodeAndOrganizationOrganizationId(String code, Long organizationId);

    @EntityGraph(attributePaths = "permissions")
    List<Role> findBySystemRoleTrue();
}
