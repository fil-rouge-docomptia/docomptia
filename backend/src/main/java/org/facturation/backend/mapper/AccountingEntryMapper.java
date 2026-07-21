package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.AccountingEntryLineResponse;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class AccountingEntryMapper {

    private static final int AMOUNT_SCALE = 2;

    public AccountingEntryResponse toResponse(AccountingEntry accountingEntry, List<AccountingEntryLine> lines) {
        AccountingEntryResponse response = new AccountingEntryResponse();
        response.setAccountingEntryId(accountingEntry.getAccountingEntryId());
        response.setEntryNumber(accountingEntry.getEntryNumber());
        response.setEntryDate(accountingEntry.getEntryDate() == null ? null : accountingEntry.getEntryDate().toString());
        response.setLabel(accountingEntry.getLabel());
        response.setStatus(accountingEntry.getStatus());
        response.setLines(lines.stream().map(this::toLineResponse).toList());
        return response;
    }

    private AccountingEntryLineResponse toLineResponse(AccountingEntryLine line) {
        AccountingEntryLineResponse response = new AccountingEntryLineResponse();
        response.setLineNumber(line.getLineNumber());
        response.setAccountNumber(line.getAccount().getAccountNumber());
        response.setAccountLabel(line.getAccount().getAccountLabel());
        response.setLineLabel(line.getLineLabel());
        response.setDebitAmount(formatAmount(line.getDebitAmount()));
        response.setCreditAmount(formatAmount(line.getCreditAmount()));
        return response;
    }

    private String formatAmount(BigDecimal amount) {
        if (amount == null) {
            return BigDecimal.ZERO.setScale(AMOUNT_SCALE).toPlainString();
        }
        return amount.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP).toPlainString();
    }
}
