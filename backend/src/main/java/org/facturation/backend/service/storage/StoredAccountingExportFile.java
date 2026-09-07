package org.facturation.backend.service.storage;

public record StoredAccountingExportFile(
        String fileName,
        String storedFileName,
        String filePath,
        Long fileSize
) {
}
