package org.facturation.backend.exception;

public class UserEmailConflictException extends RuntimeException {

    public UserEmailConflictException() {
        super("A user already uses this email");
    }
}
