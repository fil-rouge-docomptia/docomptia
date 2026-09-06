package org.facturation.backend.exception;

public class ArchivedInvoiceNotModifiableException extends RuntimeException {

    public ArchivedInvoiceNotModifiableException(Long invoiceId) {
        super("Archived invoice " + invoiceId + " is read-only and cannot be modified");
    }
}
