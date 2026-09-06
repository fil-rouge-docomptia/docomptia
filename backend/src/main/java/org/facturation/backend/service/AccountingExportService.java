package org.facturation.backend.service;

import java.time.LocalDate;

public interface AccountingExportService {

    AccountingCsvExport exportCsv(LocalDate startDate, LocalDate endDate);

    record AccountingCsvExport(String filename, byte[] content) {
    }
}
