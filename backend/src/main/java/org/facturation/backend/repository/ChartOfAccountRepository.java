package org.facturation.backend.repository;

import org.facturation.backend.model.ChartOfAccount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChartOfAccountRepository extends JpaRepository<ChartOfAccount, Long> {

    Optional<ChartOfAccount> findByAccountIdAndOrganizationOrganizationIdAndIsActiveTrue(
            Long accountId,
            Long organizationId);

    Page<ChartOfAccount> findByOrganizationOrganizationId(Long organizationId, Pageable pageable);

    Optional<ChartOfAccount> findByAccountIdAndOrganizationOrganizationId(Long accountId, Long organizationId);

    boolean existsByOrganizationOrganizationIdAndAccountNumber(Long organizationId, String accountNumber);

    boolean existsByOrganizationOrganizationIdAndAccountNumberAndAccountIdNot(
            Long organizationId,
            String accountNumber,
            Long accountId
    );
}
