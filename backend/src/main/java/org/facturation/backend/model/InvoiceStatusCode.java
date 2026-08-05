package org.facturation.backend.model;

public enum InvoiceStatusCode {
    DEPOSEE("DEPOSEE"),
    OCR_EN_COURS("OCR_EN_COURS"),
    ERREUR_OCR("ERREUR_OCR"),
    EXTRAITE("EXTRAITE"),
    COMPTABILISEE("COMPTABILISEE"),
    VALIDEE("VALIDEE"),
    REJETEE("REJETEE");

    private final String code;

    InvoiceStatusCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
