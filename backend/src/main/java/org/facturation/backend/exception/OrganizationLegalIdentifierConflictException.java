package org.facturation.backend.exception;

public class OrganizationLegalIdentifierConflictException extends RuntimeException {

    public OrganizationLegalIdentifierConflictException() {
        super("An organization already uses this siret");
    }
}
