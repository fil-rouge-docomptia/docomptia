package org.facturation.backend.security;

public enum BusinessPermission {
    VIEW_OWN_PROFILE("profile.read"), VIEW_REFERENCE_DATA("reference.read"),
    VIEW_ORGANIZATION("organization.read"), MANAGE_ORGANIZATION("organization.manage"),
    VIEW_INVOICES("invoice.read"), COMMENT_INVOICES("invoice.comment"),
    VIEW_DASHBOARD("dashboard.read"), VIEW_NOTIFICATIONS("notification.read"),
    PROCESS_INVOICES("invoice.process"), VALIDATE_INVOICES("invoice.approve"),
    MANAGE_ACCOUNTING_ENTRIES("accounting-entry.manage"), CONFIRM_INVOICE_PAYMENTS("payment.confirm"),
    VIEW_SUPPLIERS("supplier.read"),
    MANAGE_SUPPLIERS("supplier.manage"), VIEW_ACCOUNTING_CONFIGURATION("accounting-configuration.read"),
    MANAGE_ACCOUNTING_CONFIGURATION("accounting-configuration.manage"), VIEW_CLASSIFICATIONS("classification.read"),
    MANAGE_CLASSIFICATIONS("classification.manage"), MANAGE_USERS("user.manage");

    private final String code;
    BusinessPermission(String code) { this.code = code; }
    public String getCode() { return code; }
    public String authority() { return "PERMISSION_" + code; }
    public String[] authorities() { return new String[] { authority() }; }
}
