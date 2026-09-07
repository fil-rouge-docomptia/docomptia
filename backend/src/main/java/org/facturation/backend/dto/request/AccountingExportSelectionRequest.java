package org.facturation.backend.dto.request;

import java.time.LocalDate;
import java.util.List;

public record AccountingExportSelectionRequest(LocalDate startDate, LocalDate endDate, List<Long> invoiceIds) {
}
