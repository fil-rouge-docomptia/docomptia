package org.facturation.backend.dto.response;

import java.util.List;

public class AccountingExportValidationResponse extends ApiErrorResponse {

    private final List<InvoiceExportErrorResponse> invoices;

    public AccountingExportValidationResponse(
            String code,
            String message,
            List<InvoiceExportErrorResponse> invoices
    ) {
        super(code, message);
        this.invoices = invoices;
    }

    public List<InvoiceExportErrorResponse> getInvoices() {
        return invoices;
    }
}
