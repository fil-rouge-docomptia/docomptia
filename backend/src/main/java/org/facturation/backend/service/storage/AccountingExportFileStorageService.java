package org.facturation.backend.service.storage;

import org.facturation.backend.model.ExportBatch;

public interface AccountingExportFileStorageService {

    StoredAccountingExportFile store(byte[] content, String fileName, Long exportBatchId);

    void delete(StoredAccountingExportFile file);

    byte[] load(ExportBatch exportBatch);
}
