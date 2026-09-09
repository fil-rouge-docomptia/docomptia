package org.facturation.backend.service;

import org.facturation.backend.dto.request.AccountingExportPreflightRequest;
import org.facturation.backend.dto.response.AccountingExportGenerationResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;

public interface AccountingExportService {

    AccountingExportGenerationResponse generate(AccountingExportPreflightRequest request);

    AccountingCsvExport exportCsv(LocalDate startDate, LocalDate endDate);

    AccountingCsvExport exportFec(LocalDate startDate, LocalDate endDate);

    AccountingCsvExport downloadFile(Long exportBatchId);

    AccountingExportArchive archiveFile(Long exportBatchId);

    record AccountingCsvExport(String filename, byte[] content) {
    }

    record AccountingExportArchive(Long exportBatchId, String status, LocalDateTime archivedAt) {
    }
}
