package org.facturation.backend.exception;

public class InvoiceFileNotFoundException extends RuntimeException {

    public InvoiceFileNotFoundException(Long invoiceId) {
        super("Original file for invoice " + invoiceId + " not found");
    }
}
