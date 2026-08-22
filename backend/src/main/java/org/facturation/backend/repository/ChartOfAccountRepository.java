package org.facturation.backend.repository;

import org.facturation.backend.model.ChartOfAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChartOfAccountRepository extends JpaRepository<ChartOfAccount, Long> {

    Optional<ChartOfAccount> findByAccountIdAndOrganizationOrganizationIdAndIsActiveTrue(
            Long accountId,
            Long organizationId
    );
}
