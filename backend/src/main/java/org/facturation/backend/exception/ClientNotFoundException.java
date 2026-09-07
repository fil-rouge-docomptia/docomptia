package org.facturation.backend.exception;

public class ClientNotFoundException extends RuntimeException {

    public ClientNotFoundException(Long clientId) {
        super("Client " + clientId + " not found");
    }
}
