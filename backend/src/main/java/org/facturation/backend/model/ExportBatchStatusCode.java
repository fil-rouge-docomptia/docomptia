package org.facturation.backend.model;

public enum ExportBatchStatusCode {
    PREPARATION("PREPARATION"),
    GENERE("GENERE"),
    ARCHIVE("ARCHIVE");

    private final String code;

    ExportBatchStatusCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
