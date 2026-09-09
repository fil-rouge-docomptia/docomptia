package org.facturation.backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AccountingExportSelectionResponse(
        Long organizationId, String organizationName, LocalDate startDate, LocalDate endDate,
        List<Candidate> invoices, List<Totals> totals
) {
    public record Candidate(Long invoiceId, String invoiceNumber, LocalDate invoiceDate, String supplierName,
            String currencyCode, BigDecimal invoiceAmount, boolean eligible,
            BigDecimal totalDebit, BigDecimal totalCredit, List<AccountingExportControlErrorResponse> errors) {
    }

    public record Totals(String currencyCode, BigDecimal totalDebit, BigDecimal totalCredit,
            BigDecimal invoiceAmount) {
    }
}
