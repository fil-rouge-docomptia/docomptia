package org.facturation.backend.service.storage;

import org.facturation.backend.model.ExportBatch;

public interface AccountingExportFileStorageService {

    StoredAccountingExportFile store(byte[] content, String fileName, Long exportBatchId);

    byte[] load(ExportBatch exportBatch);
}
