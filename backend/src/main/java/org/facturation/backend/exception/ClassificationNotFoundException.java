package org.facturation.backend.exception;

public class ClassificationNotFoundException extends RuntimeException {
    public ClassificationNotFoundException(Long id) {
        super("Classification not found: " + id);
    }
}
