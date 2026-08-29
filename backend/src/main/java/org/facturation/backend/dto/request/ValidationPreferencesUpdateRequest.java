package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "Preferences de validation des factures de l'organisation courante")
public class ValidationPreferencesUpdateRequest {

    @Schema(description = "Active le circuit de validation", example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
    private Boolean validationRequired;

    @Schema(
            description = "Montant TTC a partir duquel une validation est requise. "
                    + "Sans seuil, toutes les factures sont soumises a validation.",
            example = "1000.00"
    )
    private BigDecimal validationThreshold;

    public Boolean getValidationRequired() {
        return validationRequired;
    }

    public void setValidationRequired(Boolean validationRequired) {
        this.validationRequired = validationRequired;
    }

    public BigDecimal getValidationThreshold() {
        return validationThreshold;
    }

    public void setValidationThreshold(BigDecimal validationThreshold) {
        this.validationThreshold = validationThreshold;
    }
}
