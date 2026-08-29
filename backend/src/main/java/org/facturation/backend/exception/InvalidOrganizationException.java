package org.facturation.backend.exception;

public class InvalidOrganizationException extends IllegalArgumentException {

    public InvalidOrganizationException(String message) {
        super(message);
    }
}
