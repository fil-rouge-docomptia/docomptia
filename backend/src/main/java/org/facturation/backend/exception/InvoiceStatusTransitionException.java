package org.facturation.backend.exception;

public class InvoiceStatusTransitionException extends IllegalStateException {

    public InvoiceStatusTransitionException(Long invoiceId, String currentStatus, String targetStatus) {
        super("Invoice " + invoiceId + " cannot transition from " + currentStatus + " to " + targetStatus);
    }

    public static InvoiceStatusTransitionException forAction(Long invoiceId, String currentStatus, String action) {
        return new InvoiceStatusTransitionException(
                "Invoice " + invoiceId + " cannot " + action + " from status " + currentStatus
        );
    }

    private InvoiceStatusTransitionException(String message) {
        super(message);
    }
}
