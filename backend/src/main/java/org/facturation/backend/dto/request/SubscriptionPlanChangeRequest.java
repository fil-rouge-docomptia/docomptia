package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Nouvelle offre demandee pour l'organisation courante")
public record SubscriptionPlanChangeRequest(
        @Schema(example = "BUSINESS", requiredMode = Schema.RequiredMode.REQUIRED)
        String planCode
) {
}
