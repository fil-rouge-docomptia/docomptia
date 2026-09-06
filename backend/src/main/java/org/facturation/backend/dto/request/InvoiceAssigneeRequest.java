package org.facturation.backend.dto.request;

public class InvoiceAssigneeRequest {

    private Long userId;
    private boolean userIdProvided;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
        this.userIdProvided = true;
    }

    public boolean wasUserIdProvided() {
        return userIdProvided;
    }
}
