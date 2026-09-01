package org.facturation.backend.dto.response;

import java.time.LocalDateTime;

public class SupplierDetailsResponse extends SupplierListItemResponse {

    private String email;
    private String phone;
    private String address;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private java.util.List<SupplierLegalIdentifierResponse> legalIdentifierHistory = java.util.List.of();

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public java.util.List<SupplierLegalIdentifierResponse> getLegalIdentifierHistory() { return legalIdentifierHistory; }
    public void setLegalIdentifierHistory(java.util.List<SupplierLegalIdentifierResponse> history) { this.legalIdentifierHistory = history; }
}
