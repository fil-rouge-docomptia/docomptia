package org.facturation.backend.model;

public enum InvoiceStatusCode {
    DEPOSEE("DEPOSEE"),
    OCR_EN_COURS("OCR_EN_COURS"),
    EXTRAITE("EXTRAITE"),
    COMPTABILISEE("COMPTABILISEE");

    private final String code;

    InvoiceStatusCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
