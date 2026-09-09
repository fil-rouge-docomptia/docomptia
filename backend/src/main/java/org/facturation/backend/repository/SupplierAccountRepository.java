package org.facturation.backend.repository;

import org.facturation.backend.model.SupplierAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupplierAccountRepository extends JpaRepository<SupplierAccount, Long> {

    List<SupplierAccount> findByOrganizationOrganizationIdAndActiveTrue(Long organizationId);

    Optional<SupplierAccount> findBySupplierAccountIdAndOrganizationOrganizationId(
            Long supplierAccountId,
            Long organizationId
    );

    Optional<SupplierAccount> findBySupplierSupplierIdAndOrganizationOrganizationIdAndActiveTrue(
            Long supplierId,
            Long organizationId
    );

    boolean existsByOrganizationOrganizationIdAndCode(Long organizationId, String code);
}
