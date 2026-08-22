package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Motif obligatoire d'une demande de correction")
public class InvoiceCorrectionDemandRequest {

    @Schema(description = "Correction attendue", example = "Le montant TTC doit etre verifie")
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
