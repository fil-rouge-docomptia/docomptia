package org.facturation.backend.dto.response;

import java.util.List;

public record ReferenceDataResponse(
        List<ReferenceItemResponse> invoiceStatuses,
        List<ReferenceItemResponse> roles,
        List<ReferenceItemResponse> currencies,
        List<ReferenceItemResponse> invoiceFileFormats
) {
}
