package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

@Schema(description = "Informations du reglement d'une facture")
public class InvoicePaymentRequest {

    @Schema(
            description = "Date obligatoire du paiement",
            example = "2026-09-06",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private LocalDate paymentDate;

    @Schema(description = "Reference facultative du paiement", example = "VIR-2026-0042")
    private String paymentReference;

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }

    public String getPaymentReference() {
        return paymentReference;
    }

    public void setPaymentReference(String paymentReference) {
        this.paymentReference = paymentReference;
    }
}
