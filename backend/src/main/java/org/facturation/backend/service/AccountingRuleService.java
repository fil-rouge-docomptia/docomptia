package org.facturation.backend.service;

import org.facturation.backend.dto.request.AccountingRuleUpdateRequest;
import org.facturation.backend.dto.response.AccountingRuleResponse;
import java.util.List;

public interface AccountingRuleService {
    List<AccountingRuleResponse> findAllForCurrentOrganization();
    AccountingRuleResponse update(Long accountingRuleId, AccountingRuleUpdateRequest request);
}
