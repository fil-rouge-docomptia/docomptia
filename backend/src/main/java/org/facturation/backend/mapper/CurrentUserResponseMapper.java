package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.CurrentUserOrganizationResponse;
import org.facturation.backend.dto.response.CurrentUserResponse;
import org.facturation.backend.dto.response.CurrentUserRoleResponse;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.User;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserResponseMapper {

    public CurrentUserResponse toResponse(User user) {
        Role role = user.getRole();
        Organization organization = user.getOrganization();
        return new CurrentUserResponse(
                user.getUserId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                new CurrentUserRoleResponse(role.getRoleId(), role.getCode(), role.getLabel()),
                new CurrentUserOrganizationResponse(
                        organization.getOrganizationId(),
                        organization.getName(),
                        organization.getLegalName()
                )
        );
    }
}
