package org.facturation.backend.exception;

public class DuplicateAlertDecisionException extends RuntimeException {

    public DuplicateAlertDecisionException(Long alertId, String currentDecision) {
        super("Duplicate alert " + alertId + " cannot receive a decision from status " + currentDecision);
    }
}
