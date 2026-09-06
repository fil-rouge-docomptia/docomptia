package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Utilisateur a inviter dans l'organisation courante")
public class UserCreateRequest {

    @Schema(description = "Prenom de l'utilisateur", example = "Marie")
    private String firstName;
    @Schema(description = "Nom de l'utilisateur", example = "Martin")
    private String lastName;
    @Schema(description = "Adresse email unique", example = "marie.martin@example.com")
    private String email;
    @Schema(
            description = "Role initial legacy. Prefer roleCodes for RBAC assignments.",
            example = "ACCOUNTANT"
    )
    private String roleCode;
    @Schema(
            description = "Roles initiaux attribues a l'utilisateur",
            example = "[\"ACCOUNTANT\", \"APPROVER\"]"
    )
    private List<String> roleCodes;

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

    public List<String> getRoleCodes() {
        return roleCodes;
    }

    public void setRoleCodes(List<String> roleCodes) {
        this.roleCodes = roleCodes;
    }
}
