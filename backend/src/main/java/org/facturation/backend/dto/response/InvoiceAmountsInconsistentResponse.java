package org.facturation.backend.dto.response;

import java.math.BigDecimal;

public class InvoiceAmountsInconsistentResponse extends ApiErrorResponse {

    private final BigDecimal expectedTtc;
    private final BigDecimal actualTtc;
    private final BigDecimal difference;
    private final BigDecimal tolerance;

    public InvoiceAmountsInconsistentResponse(
            String code,
            String message,
            BigDecimal expectedTtc,
            BigDecimal actualTtc,
            BigDecimal difference,
            BigDecimal tolerance
    ) {
        super(code, message);
        this.expectedTtc = expectedTtc;
        this.actualTtc = actualTtc;
        this.difference = difference;
        this.tolerance = tolerance;
    }

    public BigDecimal getExpectedTtc() {
        return expectedTtc;
    }

    public BigDecimal getActualTtc() {
        return actualTtc;
    }

    public BigDecimal getDifference() {
        return difference;
    }

    public BigDecimal getTolerance() {
        return tolerance;
    }
}
