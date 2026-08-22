package org.facturation.backend.exception;

public class PendingDuplicateAlertException extends RuntimeException {

    public PendingDuplicateAlertException(Long invoiceId, String action) {
        super("Invoice " + invoiceId + " cannot " + action + " while a duplicate alert is pending");
    }
}
