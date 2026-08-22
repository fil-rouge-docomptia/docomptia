package org.facturation.backend.dto.response;

import java.util.List;

public class InvoiceMissingRequiredFieldsResponse extends ApiErrorResponse {

    private final List<String> missingFields;

    public InvoiceMissingRequiredFieldsResponse(String code, String message, List<String> missingFields) {
        super(code, message);
        this.missingFields = List.copyOf(missingFields);
    }

    public List<String> getMissingFields() {
        return missingFields;
    }
}
