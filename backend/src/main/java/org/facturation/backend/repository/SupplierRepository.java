package org.facturation.backend.repository;

import org.facturation.backend.model.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    Page<Supplier> findByOrganizationOrganizationId(Long organizationId, Pageable pageable);

    Optional<Supplier> findBySupplierIdAndOrganizationOrganizationId(Long supplierId, Long organizationId);

    Optional<Supplier> findByOrganizationOrganizationIdAndNameIgnoreCase(Long organizationId, String name);

    Optional<Supplier> findByOrganizationOrganizationIdAndLegalNameIgnoreCase(Long organizationId, String legalName);

    Optional<Supplier> findByOrganizationOrganizationIdAndSiret(Long organizationId, String siret);

    Optional<Supplier> findByOrganizationOrganizationIdAndVatNumberIgnoreCase(Long organizationId, String vatNumber);

    boolean existsByOrganizationOrganizationIdAndSiretAndSupplierIdNot(
            Long organizationId,
            String siret,
            Long supplierId
    );

    boolean existsByOrganizationOrganizationIdAndVatNumberIgnoreCaseAndSupplierIdNot(
            Long organizationId,
            String vatNumber,
            Long supplierId
    );
}
