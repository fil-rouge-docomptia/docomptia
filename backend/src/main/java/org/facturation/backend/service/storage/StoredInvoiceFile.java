package org.facturation.backend.service.storage;

public record StoredInvoiceFile(
        String originalFileName,
        String storedFileName,
        String filePath,
        String mimeType,
        Long fileSize
) {
}
