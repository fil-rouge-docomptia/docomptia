package org.facturation.backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record AccountingExportHistoryResponse(
        Long exportBatchId, LocalDateTime createdAt, LocalDate periodStartDate, LocalDate periodEndDate,
        String format, String status, String fileName, String createdByName, int invoiceCount,
        List<Amount> amounts, boolean downloadable
) {
    public record Amount(String currencyCode, BigDecimal amount) {
    }
}
