package org.facturation.backend.repository;

import org.facturation.backend.model.AccountingRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccountingRuleRepository extends JpaRepository<AccountingRule, Long> {

    List<AccountingRule> findByOrganizationOrganizationIdAndActiveTrueOrderByPriorityAscAccountingRuleIdAsc(
            Long organizationId
    );
}
