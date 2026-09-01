package org.facturation.backend.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record SupplierLegalIdentifierResponse(
        Long identifierId,
        String type,
        String scheme,
        String countryCode,
        String value,
        String normalizedValue,
        LocalDate validFrom,
        LocalDate validTo,
        String source,
        boolean verified,
        String changeReason,
        Long createdByUserId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
