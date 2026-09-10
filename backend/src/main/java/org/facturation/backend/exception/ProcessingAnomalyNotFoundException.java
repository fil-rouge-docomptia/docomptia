package org.facturation.backend.exception;

public class ProcessingAnomalyNotFoundException extends RuntimeException {

    public ProcessingAnomalyNotFoundException(Long anomalyId) {
        super("Processing anomaly not found: " + anomalyId);
    }
}
