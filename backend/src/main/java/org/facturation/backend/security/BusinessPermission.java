package org.facturation.backend.security;

public enum BusinessPermission {
    USER_PROFILE_READ("user.profile.read", "View own profile"),
    REFERENCE_DATA_READ("reference-data.read", "View reference data"),
    ORGANIZATION_READ("organization.read", "View organization"),
    ORGANIZATION_MANAGE("organization.manage", "Manage organization"),
    DASHBOARD_READ("dashboard.read", "View dashboard"),
    INVOICE_READ("invoice.read", "View invoices"),
    INVOICE_UPLOAD("invoice.upload", "Upload supplier invoices"),
    INVOICE_CORRECT("invoice.correct", "Correct extracted invoice data"),
    INVOICE_SUBMIT_FOR_VALIDATION("invoice.submit-for-validation", "Submit invoices for validation"),
    INVOICE_RETRY_OCR("invoice.retry-ocr", "Retry OCR analysis"),
    INVOICE_REVIEW_DUPLICATE("invoice.review-duplicate", "Review duplicate alerts"),
    INVOICE_ASSIGN("invoice.assign", "Assign invoices"),
    INVOICE_CLASSIFY("invoice.classify", "Classify invoices"),
    INVOICE_APPROVE("invoice.approve", "Approve or reject invoices"),
    INVOICE_ACCOUNTING_GENERATE("invoice.accounting.generate", "Generate invoice accounting entries"),
    ACCOUNTING_ENTRY_UPDATE("accounting-entry.update", "Update accounting entries"),
    SUPPLIER_READ("supplier.read", "View suppliers"),
    SUPPLIER_MANAGE("supplier.manage", "Manage suppliers"),
    ACCOUNTING_CONFIGURATION_READ("accounting-configuration.read", "View accounting configuration"),
    ACCOUNTING_CONFIGURATION_MANAGE("accounting-configuration.manage", "Manage accounting configuration"),
    CLASSIFICATION_READ("classification.read", "View classifications"),
    CLASSIFICATION_MANAGE("classification.manage", "Manage classifications"),
    MEMBER_READ("member.read", "View organization members"),
    MEMBER_INVITE("member.invite", "Invite organization members"),
    MEMBER_UPDATE("member.update", "Update organization members"),
    MEMBER_STATUS_UPDATE("member.status.update", "Activate or deactivate members"),
    MEMBER_ROLE_UPDATE("member.role.update", "Update member roles"),
    MEMBER_OWNER_MANAGE("member.owner.manage", "Assign or remove the Owner role"),
    ROLE_READ("role.read", "View roles");

    private final String code;
    private final String label;

    BusinessPermission(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    public String authority() {
        return PermissionAuthority.name(this);
    }
}
