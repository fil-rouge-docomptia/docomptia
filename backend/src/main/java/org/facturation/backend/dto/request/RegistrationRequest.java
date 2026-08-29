package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Organisation et administrateur initial a creer lors de l'inscription")
public class RegistrationRequest {

    @Schema(description = "Nom usuel de l'organisation", example = "Docomptia")
    private String organizationName;
    @Schema(description = "Raison sociale de l'organisation", example = "Docomptia SAS")
    private String legalName;
    @Schema(description = "SIRET unique a 14 chiffres", example = "38012986600014")
    private String siret;
    @Schema(description = "Prenom de l'administrateur initial", example = "Marie")
    private String firstName;
    @Schema(description = "Nom de l'administrateur initial", example = "Martin")
    private String lastName;
    @Schema(description = "Adresse email unique de l'administrateur", example = "marie.martin@example.com")
    private String email;
    @Schema(description = "Mot de passe de l'administrateur", example = "change-me")
    private String password;

    public String getOrganizationName() {
        return organizationName;
    }

    public void setOrganizationName(String organizationName) {
        this.organizationName = organizationName;
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

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
