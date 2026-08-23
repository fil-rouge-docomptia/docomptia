package org.facturation.backend.dto.response;

public class LoginResponse {

    private final Long userId;
    private final String email;
    private final String firstName;
    private final String lastName;
    private final String role;
    private final Long organizationId;

    public LoginResponse(
            Long userId,
            String email,
            String firstName,
            String lastName,
            String role,
            Long organizationId
    ) {
        this.userId = userId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.role = role;
        this.organizationId = organizationId;
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

    public Long getOrganizationId() {
        return organizationId;
    }
}
