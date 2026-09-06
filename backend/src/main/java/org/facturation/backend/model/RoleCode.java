package org.facturation.backend.model;

public enum RoleCode {
    OWNER("OWNER"),
    ADMIN("ADMIN"),
    ACCOUNTING_MANAGER("ACCOUNTING_MANAGER"),
    ACCOUNTANT("ACCOUNTANT"),
    APPROVER("APPROVER"),
    VIEWER("VIEWER");

    private final String code;

    RoleCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static RoleCode fromCode(String code) {
        for (RoleCode roleCode : values()) {
            if (roleCode.code.equals(code)) {
                return roleCode;
            }
        }
        throw new IllegalStateException("Unknown role code " + code);
    }
}
