package org.facturation.backend.exception;

import java.util.List;

public class InvoiceMissingRequiredFieldsException extends IllegalStateException {

    private final List<String> missingFields;

    public InvoiceMissingRequiredFieldsException(Long invoiceId, String currentStatus, List<String> missingFields) {
        this(invoiceId, currentStatus, missingFields, "be validated");
    }

    public InvoiceMissingRequiredFieldsException(
            Long invoiceId,
            String currentStatus,
            List<String> missingFields,
            String action
    ) {
        super(
                "Invoice " + invoiceId + " cannot " + action + " from status " + currentStatus
                        + " because required fields are missing: " + String.join(", ", missingFields)
        );
        this.missingFields = List.copyOf(missingFields);
    }

    public List<String> getMissingFields() {
        return missingFields;
    }
}
