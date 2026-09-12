package org.facturation.backend.model;

public enum InvoiceOrigin {
    MANUAL_UPLOAD,
    APPROVED_PLATFORM,
    EMAIL;

    public String getCode() {
        return name();
    }
}
