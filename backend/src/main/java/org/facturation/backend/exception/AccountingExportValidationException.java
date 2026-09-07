package org.facturation.backend.exception;

import org.facturation.backend.dto.response.InvoiceExportErrorResponse;

import java.util.List;

public class AccountingExportValidationException extends RuntimeException {

    private final List<InvoiceExportErrorResponse> invoiceErrors;

    public AccountingExportValidationException(List<InvoiceExportErrorResponse> invoiceErrors) {
        super("Accounting export controls failed for " + invoiceErrors.size() + " invoice(s)");
        this.invoiceErrors = List.copyOf(invoiceErrors);
    }

    public List<InvoiceExportErrorResponse> getInvoiceErrors() {
        return invoiceErrors;
    }
}
