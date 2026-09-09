package org.facturation.backend.exception;

public class InvoiceDeletionNotAllowedException extends RuntimeException {

    public InvoiceDeletionNotAllowedException(String status) {
        super("Invoice cannot be administratively deleted from status " + status);
    }
}
