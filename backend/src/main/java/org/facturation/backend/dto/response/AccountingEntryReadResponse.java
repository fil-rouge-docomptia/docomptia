package org.facturation.backend.dto.response;

import org.facturation.backend.model.AccountingEntryExportStatus;
import java.time.LocalDateTime;
import java.util.List;

public record AccountingEntryReadResponse(
        Long invoiceId,
        String invoiceNumber,
        String supplierName,
        String currencyCode,
        String invoiceStatus,
        AccountingEntryResponse entry,
        AccountingJournalResponse journal,
        AccountingEntryExportStatus exportStatus,
        Long exportBatchId,
        LocalDateTime exportedAt,
        boolean exportEligible,
        boolean needsAttention,
        List<AccountingEntryDiagnosticResponse> diagnostics
) {
}
