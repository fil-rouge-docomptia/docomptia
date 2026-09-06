package org.facturation.backend.model;

public enum RoleCode {
    ADMIN("ADMIN"),
    OPERATEUR_COMPTABLE("OPERATEUR_COMPTABLE"),
    RESPONSABLE_COMPTABLE("RESPONSABLE_COMPTABLE");

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
