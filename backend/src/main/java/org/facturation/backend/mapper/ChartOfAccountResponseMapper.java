package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.ChartOfAccountResponse;
import org.facturation.backend.model.ChartOfAccount;
import org.springframework.stereotype.Component;

@Component
public class ChartOfAccountResponseMapper {

    public ChartOfAccountResponse toResponse(ChartOfAccount account) {
        ChartOfAccountResponse response = new ChartOfAccountResponse();
        response.setAccountId(account.getAccountId());
        response.setAccountNumber(account.getAccountNumber());
        response.setAccountLabel(account.getAccountLabel());
        response.setAccountType(account.getAccountType());
        response.setActive(account.isActive());
        response.setCreatedAt(account.getCreatedAt());
        response.setUpdatedAt(account.getUpdatedAt());
        return response;
    }
}
