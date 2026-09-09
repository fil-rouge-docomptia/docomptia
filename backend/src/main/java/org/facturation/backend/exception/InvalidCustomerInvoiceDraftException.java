package org.facturation.backend.exception;

public class InvalidCustomerInvoiceDraftException extends RuntimeException {

    public InvalidCustomerInvoiceDraftException(String message) {
        super(message);
    }
}
