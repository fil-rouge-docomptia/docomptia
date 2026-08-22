package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Motif obligatoire du refus d'une facture")
public class InvoiceRejectionRequest {

    @Schema(description = "Motif du refus", example = "Le montant TTC ne correspond pas au document")
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
