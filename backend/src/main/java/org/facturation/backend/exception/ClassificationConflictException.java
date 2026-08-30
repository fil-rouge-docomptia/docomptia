package org.facturation.backend.exception;

public class ClassificationConflictException extends RuntimeException {
    public ClassificationConflictException(String name) {
        super("A classification with this type and name already exists: " + name);
    }
}
