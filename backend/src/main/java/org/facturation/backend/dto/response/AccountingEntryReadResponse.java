package org.facturation.backend.dto.response;

public record AccountingEntryReadResponse(
        Long invoiceId,
        String invoiceNumber,
        String supplierName,
        String currencyCode,
        String invoiceStatus,
        AccountingEntryResponse entry
) {
}
