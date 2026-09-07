package org.facturation.backend.exception;

public class CustomerInvoiceDraftNotModifiableException extends RuntimeException {

    public CustomerInvoiceDraftNotModifiableException(Long invoiceId) {
        super("Invoice " + invoiceId + " is not a customer draft");
    }
}
