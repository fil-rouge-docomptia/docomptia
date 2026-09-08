package org.facturation.backend.dto.response;

import org.facturation.backend.model.ExportBatchFormat;

import java.time.LocalDateTime;
import java.util.List;

public record AccountingExportGenerationResponse(
        Long exportBatchId, Long organizationId, ExportBatchFormat format, String status,
        String fileName, Long fileSize, LocalDateTime generatedAt, String createdByName,
        List<Long> invoiceIds
) {
}
