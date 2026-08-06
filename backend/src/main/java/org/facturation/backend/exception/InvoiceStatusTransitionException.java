package org.facturation.backend.exception;

public class InvoiceStatusTransitionException extends IllegalStateException {

    public InvoiceStatusTransitionException(Long invoiceId, String currentStatus, String targetStatus) {
        super("Invoice " + invoiceId + " cannot transition from " + currentStatus + " to " + targetStatus);
    }
}
