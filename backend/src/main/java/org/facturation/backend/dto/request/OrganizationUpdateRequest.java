package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Informations legales et de contact modifiables de l'organisation courante")
public class OrganizationUpdateRequest {

    @Schema(description = "Nom usuel", example = "Docomptia")
    private String name;
    @Schema(description = "Raison sociale", example = "Docomptia SAS")
    private String legalName;
    @Schema(description = "SIRET a 14 chiffres", example = "12345678901234")
    private String siret;
    @Schema(description = "Adresse email de contact", example = "contact@docomptia.fr")
    private String email;
    @Schema(description = "Numero de telephone. Une chaine vide supprime la valeur.", example = "0102030405")
    private String phone;
    @Schema(description = "Adresse postale. Une chaine vide supprime la valeur.")
    private String address;
    @Schema(description = "Code ISO 4217 de la devise utilisee par defaut", example = "EUR")
    private String defaultCurrencyCode;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLegalName() {
        return legalName;
    }

    public void setLegalName(String legalName) {
        this.legalName = legalName;
    }

    public String getSiret() {
        return siret;
    }

    public void setSiret(String siret) {
        this.siret = siret;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getDefaultCurrencyCode() {
        return defaultCurrencyCode;
    }

    public void setDefaultCurrencyCode(String defaultCurrencyCode) {
        this.defaultCurrencyCode = defaultCurrencyCode;
    }
}
