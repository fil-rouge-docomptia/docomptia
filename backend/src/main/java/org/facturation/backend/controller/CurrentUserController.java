package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.CurrentUserResponse;
import org.facturation.backend.mapper.CurrentUserResponseMapper;
import org.facturation.backend.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Utilisateurs", description = "Consultation de l'utilisateur connecte")
public class CurrentUserController {

    private final UserService userService;
    private final CurrentUserResponseMapper currentUserResponseMapper;

    public CurrentUserController(UserService userService, CurrentUserResponseMapper currentUserResponseMapper) {
        this.userService = userService;
        this.currentUserResponseMapper = currentUserResponseMapper;
    }

    @GetMapping("/me")
    @Operation(summary = "Consulter le profil de l'utilisateur connecte")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    public ResponseEntity<CurrentUserResponse> getCurrentUser(Authentication authentication) {
        return ResponseEntity.ok(currentUserResponseMapper.toResponse(userService.findByEmail(authentication.getName())));
    }
}
