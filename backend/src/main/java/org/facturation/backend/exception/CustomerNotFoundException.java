package org.facturation.backend.exception;

public class CustomerNotFoundException extends RuntimeException {

    public CustomerNotFoundException(Long customerId) {
        super("Customer " + customerId + " not found");
    }
}
