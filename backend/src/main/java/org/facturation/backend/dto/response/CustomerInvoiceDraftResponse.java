package org.facturation.backend.dto.response;

public record CustomerInvoiceDraftResponse(
        Long invoiceId,
        Long clientId,
        String clientName,
        String status,
        String invoiceNumber,
        String currencyCode,
        String invoiceDate,
        String dueDate,
        String commandReference,
        String description
) {
}
