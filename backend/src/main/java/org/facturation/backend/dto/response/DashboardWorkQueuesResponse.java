package org.facturation.backend.dto.response;

public record DashboardWorkQueuesResponse(
        long toProcess,
        long toVerify,
        long awaitingValidation,
        long exportable
) {
}
