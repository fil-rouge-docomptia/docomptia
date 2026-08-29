package org.facturation.backend.repository;

import org.facturation.backend.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    boolean existsBySiret(String siret);

    boolean existsBySiretAndOrganizationIdNot(String siret, Long organizationId);
}
