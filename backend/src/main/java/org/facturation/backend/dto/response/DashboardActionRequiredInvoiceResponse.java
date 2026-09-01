package org.facturation.backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DashboardActionRequiredInvoiceResponse(
        Long invoiceId,
        String invoiceNumber,
        LocalDate invoiceDate,
        String supplierName,
        BigDecimal totalTtc,
        String currencyCode,
        String status,
        String requiredAction
) {
}
