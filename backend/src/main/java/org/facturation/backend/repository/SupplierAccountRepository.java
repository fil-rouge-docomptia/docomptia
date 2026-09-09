package org.facturation.backend.repository;

import org.facturation.backend.model.SupplierAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SupplierAccountRepository extends JpaRepository<SupplierAccount, Long> {

    @Query("""
            select account from SupplierAccount account
            where account.organization.organizationId = :organizationId
              and account.active = true
              and account.collectiveAccount.isActive = true
            """)
    List<SupplierAccount> findByOrganizationOrganizationIdAndActiveTrue(
            @Param("organizationId") Long organizationId);

    Optional<SupplierAccount> findBySupplierAccountIdAndOrganizationOrganizationId(
            Long supplierAccountId,
            Long organizationId
    );

    @Query("""
            select account from SupplierAccount account
            where account.supplier.supplierId = :supplierId
              and account.organization.organizationId = :organizationId
              and account.active = true
              and account.collectiveAccount.isActive = true
            """)
    Optional<SupplierAccount> findBySupplierSupplierIdAndOrganizationOrganizationIdAndActiveTrue(
            @Param("supplierId") Long supplierId,
            @Param("organizationId") Long organizationId);

    boolean existsByOrganizationOrganizationIdAndCode(Long organizationId, String code);
}
