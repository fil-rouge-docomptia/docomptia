package org.facturation.backend.repository;

import org.facturation.backend.model.SupplierLegalIdentifier;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;

public interface SupplierLegalIdentifierRepository extends JpaRepository<SupplierLegalIdentifier, Long> {
    @EntityGraph(attributePaths = "supplier")
    Optional<SupplierLegalIdentifier> findFirstByOrganizationOrganizationIdAndSchemeAndCountryCodeAndNormalizedValueAndValidToIsNull(
            Long organizationId, String scheme, String countryCode, String normalizedValue);

    Optional<SupplierLegalIdentifier> findFirstBySupplierSupplierIdAndSchemeAndCountryCodeAndValidToIsNull(
            Long supplierId, String scheme, String countryCode);

    List<SupplierLegalIdentifier> findBySupplierSupplierIdOrderByValidToAscCreatedAtDesc(Long supplierId);

    Optional<SupplierLegalIdentifier> findBySupplierLegalIdentifierIdAndSupplierSupplierIdAndOrganizationOrganizationId(
            Long identifierId, Long supplierId, Long organizationId);
}
