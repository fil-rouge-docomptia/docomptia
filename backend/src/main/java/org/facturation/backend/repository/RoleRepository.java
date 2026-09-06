package org.facturation.backend.repository;

import org.facturation.backend.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;

public interface RoleRepository extends JpaRepository<Role, Long> {

    Optional<Role> findByCode(String code);
    Optional<Role> findByCodeAndOrganizationIsNull(String code);

    @EntityGraph(attributePaths = "permissions")
    List<Role> findBySystemRoleTrue();

    Optional<Role> findByOrganizationOrganizationIdAndCode(Long organizationId, String code);
}
