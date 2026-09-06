package org.facturation.backend.dto.response;

import java.util.List;
import java.util.Set;

public class LoginResponse {

    private final Long userId;
    private final String email;
    private final String firstName;
    private final String lastName;
    private final String role;
    private final List<CurrentUserRoleResponse> roles;
    private final Set<String> permissions;
    private final Long organizationId;
    private final String token;

    public LoginResponse(
            Long userId,
            String email,
            String firstName,
            String lastName,
            String role,
            List<CurrentUserRoleResponse> roles,
            Set<String> permissions,
            Long organizationId,
            String token
    ) {
        this.userId = userId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.role = role;
        this.roles = roles;
        this.permissions = permissions;
        this.organizationId = organizationId;
        this.token = token;
    }

    public Long getUserId() {
        return userId;
    }

    public String getEmail() {
        return email;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getRole() {
        return role;
    }

    public List<CurrentUserRoleResponse> getRoles() {
        return roles;
    }

    public Set<String> getPermissions() {
        return permissions;
    }

    public Long getOrganizationId() {
        return organizationId;
    }

    public String getToken() {
        return token;
    }
}
