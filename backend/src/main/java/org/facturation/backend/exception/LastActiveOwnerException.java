package org.facturation.backend.exception;

public class LastActiveOwnerException extends RuntimeException {

    public LastActiveOwnerException() {
        super("The last active owner cannot be deactivated or lose the Owner role");
    }
}
