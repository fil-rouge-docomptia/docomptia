package org.facturation.backend.repository;

import org.facturation.backend.model.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    Optional<Supplier> findByOrganizationOrganizationIdAndNameIgnoreCase(Long organizationId, String name);

    Optional<Supplier> findByOrganizationOrganizationIdAndLegalNameIgnoreCase(Long organizationId, String legalName);
}
