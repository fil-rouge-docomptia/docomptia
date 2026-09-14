package org.facturation.backend.exception;

import java.math.BigDecimal;

public class InvoiceAmountsInconsistentException extends IllegalStateException {

    private final BigDecimal expectedTtc;
    private final BigDecimal actualTtc;
    private final BigDecimal difference;
    private final BigDecimal tolerance;

    public InvoiceAmountsInconsistentException(
            Long invoiceId,
            BigDecimal expectedTtc,
            BigDecimal actualTtc,
            BigDecimal difference,
            BigDecimal tolerance
    ) {
        super("Invoice " + invoiceId + " has inconsistent amounts: HT + TVA = " + expectedTtc
                + ", but TTC = " + actualTtc + " (difference " + difference
                + ", accepted tolerance " + tolerance + ")");
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
