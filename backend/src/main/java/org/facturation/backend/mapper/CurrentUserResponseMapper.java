package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.CurrentUserOrganizationResponse;
import org.facturation.backend.dto.response.CurrentUserResponse;
import org.facturation.backend.dto.response.CurrentUserRoleResponse;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.User;
import org.facturation.backend.security.PermissionAuthority;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class CurrentUserResponseMapper {

    public CurrentUserResponse toResponse(User user) {
        Role role = primaryRole(user);
        Organization organization = user.getOrganization();
        return new CurrentUserResponse(
                user.getUserId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                new CurrentUserRoleResponse(role.getRoleId(), role.getCode(), role.getLabel()),
                toRoles(user),
                PermissionAuthority.permissionCodes(user),
                new CurrentUserOrganizationResponse(
                        organization.getOrganizationId(),
                        organization.getName(),
                        organization.getLegalName()
                )
        );
    }

    private Role primaryRole(User user) {
        return user.getEffectiveRoles().stream()
                .min(Comparator.comparing(Role::getRoleId))
                .orElse(user.getRole());
    }

    private List<CurrentUserRoleResponse> toRoles(User user) {
        return user.getEffectiveRoles().stream()
                .sorted(Comparator.comparing(Role::getRoleId))
                .map(role -> new CurrentUserRoleResponse(role.getRoleId(), role.getCode(), role.getLabel()))
                .toList();
    }
}
