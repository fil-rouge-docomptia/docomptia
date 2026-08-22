package org.facturation.backend.dto.request;

public class DuplicateAlertDecisionRequest {

    private String decision;
    private String reason;

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
