package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.CurrentUserRoleResponse;
import org.facturation.backend.dto.response.UserListItemResponse;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.User;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class UserResponseMapper {

    public UserListItemResponse toListItemResponse(User user) {
        Role role = primaryRole(user);
        return new UserListItemResponse(
                user.getUserId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                new CurrentUserRoleResponse(role.getRoleId(), role.getCode(), role.getLabel()),
                toRoles(user),
                user.isActive()
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
