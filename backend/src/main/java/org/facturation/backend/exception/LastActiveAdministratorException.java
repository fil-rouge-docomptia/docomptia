package org.facturation.backend.exception;

public class LastActiveAdministratorException extends RuntimeException {

    public LastActiveAdministratorException() {
        super("The last active administrator cannot be deactivated or assigned another role");
    }
}
