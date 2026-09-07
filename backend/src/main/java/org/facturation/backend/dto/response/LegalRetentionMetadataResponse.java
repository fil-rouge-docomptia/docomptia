package org.facturation.backend.dto.response;

public record LegalRetentionMetadataResponse(
        Long invoiceFileId,
        String archivedAt,
        Integer retentionDurationYears,
        String integrityStatus,
        String storageLocation
) {
}
