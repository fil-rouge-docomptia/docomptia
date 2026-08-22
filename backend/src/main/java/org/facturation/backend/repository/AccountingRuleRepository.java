package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountingRuleRepository extends JpaRepository<AccountingRule, Long> {

    List<AccountingRule> findByOrganizationOrganizationIdOrderByPriorityAscAccountingRuleIdAsc(Long organizationId);

    Optional<AccountingRule> findByAccountingRuleIdAndOrganizationOrganizationId(
            Long accountingRuleId,
            Long organizationId
    );

    List<AccountingRule> findByOrganizationOrganizationIdAndActiveTrueOrderByPriorityAscAccountingRuleIdAsc(
            Long organizationId
    );
}
