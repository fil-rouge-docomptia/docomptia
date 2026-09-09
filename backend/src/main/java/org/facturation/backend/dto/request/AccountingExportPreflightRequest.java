package org.facturation.backend.dto.request;

import org.facturation.backend.model.ExportBatchFormat;

import java.time.LocalDate;
import java.util.List;

public record AccountingExportPreflightRequest(
        LocalDate startDate,
        LocalDate endDate,
        List<Long> invoiceIds,
        ExportBatchFormat format
) {
}
