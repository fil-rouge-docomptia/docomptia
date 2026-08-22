package org.facturation.backend.dto.request;

import java.math.BigDecimal;

public class AccountingEntryLineCorrectionRequest {

    private Long accountId;
    private String lineLabel;
    private BigDecimal debitAmount;
    private BigDecimal creditAmount;

    public Long getAccountId() {
        return accountId;
    }

    public void setAccountId(Long accountId) {
        this.accountId = accountId;
    }

    public String getLineLabel() {
        return lineLabel;
    }

    public void setLineLabel(String lineLabel) {
        this.lineLabel = lineLabel;
    }

    public BigDecimal getDebitAmount() {
        return debitAmount;
    }

    public void setDebitAmount(BigDecimal debitAmount) {
        this.debitAmount = debitAmount;
    }

    public BigDecimal getCreditAmount() {
        return creditAmount;
    }

    public void setCreditAmount(BigDecimal creditAmount) {
        this.creditAmount = creditAmount;
    }
}
