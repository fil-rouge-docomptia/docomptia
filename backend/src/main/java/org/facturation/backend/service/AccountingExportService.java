package org.facturation.backend.service;

import java.time.LocalDate;

public interface AccountingExportService {

    AccountingCsvExport exportCsv(LocalDate startDate, LocalDate endDate);

    AccountingCsvExport exportFec(LocalDate startDate, LocalDate endDate);

    AccountingCsvExport downloadFile(Long exportBatchId);

    record AccountingCsvExport(String filename, byte[] content) {
    }
}
