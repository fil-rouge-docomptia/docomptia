package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.CurrentUserRoleResponse;
import org.facturation.backend.dto.response.UserListItemResponse;
import org.facturation.backend.model.Role;
import org.facturation.backend.model.User;
import org.springframework.stereotype.Component;

@Component
public class UserResponseMapper {

    public UserListItemResponse toListItemResponse(User user) {
        Role role = user.getRole();
        return new UserListItemResponse(
                user.getUserId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                new CurrentUserRoleResponse(role.getRoleId(), role.getCode(), role.getLabel()),
                user.isActive()
        );
    }
}
