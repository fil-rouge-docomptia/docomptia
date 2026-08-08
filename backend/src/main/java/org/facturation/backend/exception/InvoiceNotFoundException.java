package org.facturation.backend.exception;

public class InvoiceNotFoundException extends RuntimeException {

    public InvoiceNotFoundException(Long invoiceId) {
        super("Invoice " + invoiceId + " not found");
    }
}
