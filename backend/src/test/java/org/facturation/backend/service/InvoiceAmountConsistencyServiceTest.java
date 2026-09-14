package org.facturation.backend.service;

import org.facturation.backend.exception.InvoiceAmountsInconsistentException;
import org.facturation.backend.model.Invoice;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class InvoiceAmountConsistencyServiceTest {

    private final InvoiceAmountConsistencyService service = new InvoiceAmountConsistencyService();

    @Test
    void acceptsCoherentAmountsAndOneCentRoundingDifference() {
        assertDoesNotThrow(() -> service.ensureConsistent(invoice("100.00", "20.00", "120.00")));
        assertDoesNotThrow(() -> service.ensureConsistent(invoice("100.00", "20.00", "120.01")));
    }

    @Test
    void reportsAnExplicitDifferenceWhenAmountsAreInconsistent() {
        InvoiceAmountsInconsistentException exception = assertThrows(
                InvoiceAmountsInconsistentException.class,
                () -> service.ensureConsistent(invoice("100.00", "20.00", "120.02"))
        );

        assertEquals(new BigDecimal("120.00"), exception.getExpectedTtc());
        assertEquals(new BigDecimal("120.02"), exception.getActualTtc());
        assertEquals(new BigDecimal("0.02"), exception.getDifference());
        assertEquals(new BigDecimal("0.01"), exception.getTolerance());
    }

    @Test
    void leavesMissingDataForTheRequiredFieldsControl() {
        Invoice invoice = invoice("100.00", null, null);

        assertDoesNotThrow(() -> service.ensureConsistent(invoice));
        service.recalculateTtcWhenMissingOrWithinTolerance(invoice);

        assertNull(invoice.getTotalTtc());
    }

    @Test
    void calculatesMissingTtcAndNormalizesAnAcceptedRoundingDifference() {
        Invoice missingTtc = invoice("100.00", "20.00", null);
        Invoice roundedTtc = invoice("100.00", "20.00", "120.01");

        service.recalculateTtcWhenMissingOrWithinTolerance(missingTtc);
        service.recalculateTtcWhenMissingOrWithinTolerance(roundedTtc);

        assertEquals(new BigDecimal("120.00"), missingTtc.getTotalTtc());
        assertEquals(new BigDecimal("120.00"), roundedTtc.getTotalTtc());
    }

    private Invoice invoice(String totalHt, String totalTva, String totalTtc) {
        Invoice invoice = new Invoice();
        invoice.setInvoiceId(42L);
        invoice.setTotalHt(amount(totalHt));
        invoice.setTotalTva(amount(totalTva));
        invoice.setTotalTtc(amount(totalTtc));
        return invoice;
    }

    private BigDecimal amount(String value) {
        return value == null ? null : new BigDecimal(value);
    }
}
