package org.facturation.backend.model;

public enum InvoiceStatusCode {
    DEPOSEE("DEPOSEE"),
    OCR_EN_COURS("OCR_EN_COURS"),
    ERREUR_OCR("ERREUR_OCR"),
    EXTRAITE("EXTRAITE"),
    COMPTABILISEE("COMPTABILISEE"),
    A_VERIFIER("A_VERIFIER"),
    VALIDEE("VALIDEE"),
    REJETEE("REJETEE"),
    EXPORTABLE("EXPORTABLE"),
    EXPORTEE("EXPORTEE"),
    PAYEE("PAYEE"),
    ARCHIVEE("ARCHIVEE");

    private final String code;

    InvoiceStatusCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static InvoiceStatusCode fromCode(String code) {
        for (InvoiceStatusCode statusCode : values()) {
            if (statusCode.code.equals(code)) {
                return statusCode;
            }
        }
        throw new IllegalStateException("Unknown invoice status code " + code);
    }
}
