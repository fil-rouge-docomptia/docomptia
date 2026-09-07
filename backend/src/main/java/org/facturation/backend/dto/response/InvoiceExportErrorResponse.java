package org.facturation.backend.dto.response;

import java.util.List;

public record InvoiceExportErrorResponse(
        Long invoiceId,
        String invoiceNumber,
        List<AccountingExportControlErrorResponse> errors
) {
}
