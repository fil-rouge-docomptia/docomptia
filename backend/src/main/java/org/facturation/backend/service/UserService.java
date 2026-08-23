package org.facturation.backend.service;

import org.facturation.backend.model.User;
import org.facturation.backend.model.Organization;
import org.facturation.backend.dto.request.UserCreateRequest;
import org.facturation.backend.dto.response.UserListItemResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface UserService {

    List<User> findAll();

    Optional<User> findById(Long id);

    User findByEmail(String email);

    User save(User user);

    User changePassword(Long id, String rawPassword);

    Page<UserListItemResponse> findPageForOrganization(Long organizationId, Pageable pageable);

    UserListItemResponse invite(UserCreateRequest request, Organization organization);
}
