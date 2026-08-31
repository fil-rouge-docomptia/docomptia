package org.facturation.backend.dto.response;

import java.math.BigDecimal;

public record DashboardTotalsResponse(
        long invoiceCount,
        BigDecimal totalHt,
        BigDecimal totalTva,
        BigDecimal totalTtc
) {
}
