package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Compte a ajouter au plan comptable de l'organisation")
public class ChartOfAccountCreateRequest {

    @Schema(description = "Numero de compte unique dans l'organisation", example = "606300")
    private String accountNumber;
    @Schema(description = "Libelle du compte", example = "Fournitures d'entretien")
    private String accountLabel;
    @Schema(description = "Type de compte", example = "CHARGE")
    private String accountType;

    public String getAccountNumber() {
        return accountNumber;
    }

    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }

    public String getAccountLabel() {
        return accountLabel;
    }

    public void setAccountLabel(String accountLabel) {
        this.accountLabel = accountLabel;
    }

    public String getAccountType() {
        return accountType;
    }

    public void setAccountType(String accountType) {
        this.accountType = accountType;
    }
}
