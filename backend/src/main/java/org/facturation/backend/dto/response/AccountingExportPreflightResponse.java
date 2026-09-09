package org.facturation.backend.dto.response;

import org.facturation.backend.model.ExportBatchFormat;

public record AccountingExportPreflightResponse(
        ExportBatchFormat format,
        AccountingExportSelectionResponse selection
) {
}
