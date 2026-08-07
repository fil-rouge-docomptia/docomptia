package org.facturation.backend.exception;

import java.util.List;

public class InvoiceMissingRequiredFieldsException extends IllegalStateException {

    private final List<String> missingFields;

    public InvoiceMissingRequiredFieldsException(Long invoiceId, String currentStatus, List<String> missingFields) {
        super(
                "Invoice " + invoiceId + " cannot be validated from status " + currentStatus
                        + " because required fields are missing: " + String.join(", ", missingFields)
        );
        this.missingFields = List.copyOf(missingFields);
    }

    public List<String> getMissingFields() {
        return missingFields;
    }
}
