package org.facturation.backend.model;

public enum AccountingEntryStatusCode {
    GENERATED("GENERATED");

    private final String code;

    AccountingEntryStatusCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
