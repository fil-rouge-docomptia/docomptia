package org.facturation.backend.repository;

import org.facturation.backend.model.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @EntityGraph(attributePaths = {"role.permissions", "roles.permissions", "organization"})
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndUserIdNot(String email, Long userId);

    @EntityGraph(attributePaths = {"role", "roles"})
    Page<User> findByOrganizationOrganizationId(Long organizationId, Pageable pageable);

    @EntityGraph(attributePaths = {"role.permissions", "roles.permissions", "organization"})
    Optional<User> findByUserIdAndOrganizationOrganizationId(Long userId, Long organizationId);

    @EntityGraph(attributePaths = {"role", "organization"})
    @Query("""
            select user from User user
            where user.organization.organizationId = :organizationId
              and user.isActive = true
              and user.role.code = :roleCode
            """)
    List<User> findActiveUsersByOrganizationAndRole(
            @Param("organizationId") Long organizationId,
            @Param("roleCode") String roleCode
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select user from User user
            where user.organization.organizationId = :organizationId
              and user.isActive = true
              and user.role.code = 'ADMIN'
            """)
    List<User> findActiveAdministratorsForUpdate(@Param("organizationId") Long organizationId);

    @Override
    @EntityGraph(attributePaths = {"role.permissions", "roles.permissions", "organization"})
    Optional<User> findById(Long userId);
}
