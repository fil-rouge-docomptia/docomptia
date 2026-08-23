package org.facturation.backend.repository;

import org.facturation.backend.model.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @EntityGraph(attributePaths = {"role", "organization"})
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = "role")
    Page<User> findByOrganizationOrganizationId(Long organizationId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"role", "organization"})
    Optional<User> findById(Long userId);
}
