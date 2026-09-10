package org.facturation.backend.service;

import org.facturation.backend.exception.InvoiceAmountsInconsistentException;
import org.facturation.backend.model.Invoice;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class InvoiceAmountConsistencyService {

    public static final BigDecimal ROUNDING_TOLERANCE = new BigDecimal("0.01");
    private static final int AMOUNT_SCALE = 2;

    public void recalculateTtcWhenMissingOrWithinTolerance(Invoice invoice) {
        BigDecimal expectedTtc = expectedTtc(invoice);
        if (expectedTtc == null) {
            return;
        }

        BigDecimal actualTtc = normalize(invoice.getTotalTtc());
        if (actualTtc == null || difference(expectedTtc, actualTtc).compareTo(ROUNDING_TOLERANCE) <= 0) {
            invoice.setTotalTtc(expectedTtc);
        }
    }

    public void recalculateTtcAfterComponentCorrection(Invoice invoice) {
        BigDecimal expectedTtc = expectedTtc(invoice);
        if (expectedTtc != null) {
            invoice.setTotalTtc(expectedTtc);
        }
    }

    public void ensureConsistent(Invoice invoice) {
        BigDecimal expectedTtc = expectedTtc(invoice);
        BigDecimal actualTtc = normalize(invoice.getTotalTtc());
        if (expectedTtc == null || actualTtc == null) {
            return;
        }

        BigDecimal difference = difference(expectedTtc, actualTtc);
        if (difference.compareTo(ROUNDING_TOLERANCE) > 0) {
            throw new InvoiceAmountsInconsistentException(
                    invoice.getInvoiceId(), expectedTtc, actualTtc, difference, ROUNDING_TOLERANCE
            );
        }
    }

    public boolean isConsistent(Invoice invoice) {
        BigDecimal expectedTtc = expectedTtc(invoice);
        BigDecimal actualTtc = normalize(invoice.getTotalTtc());
        return expectedTtc != null && actualTtc != null
                && difference(expectedTtc, actualTtc).compareTo(ROUNDING_TOLERANCE) <= 0;
    }

    public BigDecimal expectedTtc(Invoice invoice) {
        BigDecimal totalHt = normalize(invoice.getTotalHt());
        BigDecimal totalTva = normalize(invoice.getTotalTva());
        return totalHt == null || totalTva == null ? null : totalHt.add(totalTva);
    }

    private BigDecimal difference(BigDecimal expectedTtc, BigDecimal actualTtc) {
        return expectedTtc.subtract(actualTtc).abs();
    }

    private BigDecimal normalize(BigDecimal amount) {
        return amount == null ? null : amount.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
    }
}
