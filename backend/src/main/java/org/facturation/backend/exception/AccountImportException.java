package org.facturation.backend.exception;

import org.springframework.http.HttpStatus;

public class AccountImportException extends RuntimeException {
    private final HttpStatus status;

    public AccountImportException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() { return status; }
}
