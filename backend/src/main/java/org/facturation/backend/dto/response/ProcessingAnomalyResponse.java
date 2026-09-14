package org.facturation.backend.dto.response;

import java.time.LocalDateTime;

public record ProcessingAnomalyResponse(
        Long id,
        Long invoiceId,
        String invoiceNumber,
        Long organizationId,
        String code,
        String label,
        String description,
        boolean blocking,
        LocalDateTime createdAt,
        LocalDateTime resolvedAt
) {
}
