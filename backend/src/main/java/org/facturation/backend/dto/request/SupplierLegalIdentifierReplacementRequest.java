package org.facturation.backend.dto.request;

import java.time.LocalDate;

public record SupplierLegalIdentifierReplacementRequest(
        String type,
        String scheme,
        String countryCode,
        String value,
        LocalDate validFrom,
        String reason
) {}
