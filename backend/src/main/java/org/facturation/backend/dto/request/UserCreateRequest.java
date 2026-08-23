package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Utilisateur a inviter dans l'organisation courante")
public class UserCreateRequest {

    @Schema(description = "Prenom de l'utilisateur", example = "Marie")
    private String firstName;
    @Schema(description = "Nom de l'utilisateur", example = "Martin")
    private String lastName;
    @Schema(description = "Adresse email unique", example = "marie.martin@example.com")
    private String email;
    @Schema(
            description = "Role initial autorise: ADMIN, OPERATEUR_COMPTABLE ou RESPONSABLE_COMPTABLE",
            example = "OPERATEUR_COMPTABLE"
    )
    private String roleCode;

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

    public String getRoleCode() {
        return roleCode;
    }

    public void setRoleCode(String roleCode) {
        this.roleCode = roleCode;
    }
}
