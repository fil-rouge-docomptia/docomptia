package org.facturation.backend.exception;

public class DuplicateAlertNotFoundException extends RuntimeException {

    public DuplicateAlertNotFoundException(Long alertId, Long invoiceId) {
        super("Duplicate alert " + alertId + " not found for invoice " + invoiceId);
    }
}
