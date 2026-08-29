package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Informations d'identite modifiables d'un utilisateur")
public class UserUpdateRequest {

    @Schema(description = "Prenom de l'utilisateur", example = "Marie")
    private String firstName;
    @Schema(description = "Nom de l'utilisateur", example = "Martin")
    private String lastName;
    @Schema(description = "Adresse email unique", example = "marie.martin@example.com")
    private String email;

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
}
