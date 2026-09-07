package org.facturation.backend.model;

public enum ExportBatchFormat {
    CSV("CSV");

    private final String code;

    ExportBatchFormat(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
