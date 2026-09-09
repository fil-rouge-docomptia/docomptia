package org.facturation.backend.dto.response;

import java.time.LocalDate;

public record AccountingExportSummaryResponse(long readyToExport, long blockedInvoices,
        long exportedThisMonth, LocalDate monthStart, LocalDate monthEnd) {
}
