package org.facturation.backend.dto.response;

public record InvoiceSupplierResponse(
        Long supplierId,
        String currentLegalName,
        String currentTradeName,
        String currentCountryCode,
        String snapshotLegalName,
        String snapshotAddress,
        String snapshotIdentifiers,
        boolean confirmed
) {}
