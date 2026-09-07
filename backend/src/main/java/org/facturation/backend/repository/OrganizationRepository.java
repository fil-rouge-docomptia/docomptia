package org.facturation.backend.repository;

import jakarta.persistence.LockModeType;
import org.facturation.backend.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    boolean existsBySiret(String siret);

    boolean existsBySiretAndOrganizationIdNot(String siret, Long organizationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select organization from Organization organization where organization.organizationId = :organizationId")
    Optional<Organization> findByIdForPieceNumberUpdate(@Param("organizationId") Long organizationId);
}
