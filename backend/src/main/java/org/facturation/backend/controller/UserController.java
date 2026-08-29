package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.UserCreateRequest;
import org.facturation.backend.dto.request.UserStatusUpdateRequest;
import org.facturation.backend.dto.request.UserUpdateRequest;
import org.facturation.backend.dto.response.UserListItemResponse;
import org.facturation.backend.model.User;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Utilisateurs", description = "Consultation des utilisateurs de l'organisation")
public class UserController {

    private static final Map<String, String> SORT_PROPERTIES = Map.of(
            "firstName", "firstName",
            "lastName", "lastName",
            "email", "email",
            "role", "role.code",
            "active", "isActive"
    );

    private final UserService userService;
    private final CurrentUserService currentUserService;

    public UserController(UserService userService, CurrentUserService currentUserService) {
        this.userService = userService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @Operation(summary = "Lister les utilisateurs de l'organisation")
    public ResponseEntity<Page<UserListItemResponse>> listUsers(
            @Parameter(description = "Numero de page, commence a zero", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Nombre d'utilisateurs par page", example = "20")
            @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Champ de tri: firstName, lastName, email, role ou active")
            @RequestParam(defaultValue = "lastName") String sortBy,
            @Parameter(description = "Sens du tri: ASC ou DESC")
            @RequestParam(defaultValue = "ASC") Sort.Direction direction
    ) {
        String sortProperty = SORT_PROPERTIES.getOrDefault(sortBy, "lastName");
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(direction, sortProperty).and(Sort.by("userId").ascending())
        );
        User currentUser = currentUserService.getCurrentUser();
        Long organizationId = currentUser.getOrganization().getOrganizationId();
        return ResponseEntity.ok(userService.findPageForOrganization(organizationId, pageRequest));
    }

    @PostMapping
    @Operation(summary = "Inviter un utilisateur dans l'organisation")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Utilisateur invite"),
            @ApiResponse(responseCode = "400", description = "Donnees invalides ou role non autorise"),
            @ApiResponse(responseCode = "409", description = "Adresse email deja utilisee")
    })
    public ResponseEntity<UserListItemResponse> inviteUser(@RequestBody UserCreateRequest request) {
        User currentUser = currentUserService.getCurrentUser();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userService.invite(request, currentUser.getOrganization()));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Activer ou desactiver un utilisateur")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Etat de l'utilisateur modifie"),
            @ApiResponse(responseCode = "400", description = "Etat manquant ou deja applique"),
            @ApiResponse(responseCode = "404", description = "Utilisateur introuvable dans l'organisation")
    })
    public ResponseEntity<UserListItemResponse> updateStatus(
            @PathVariable Long id,
            @RequestBody UserStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(userService.updateStatus(id, request, currentUserService.getCurrentUser()));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Modifier les informations d'identite d'un utilisateur")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Utilisateur modifie"),
            @ApiResponse(responseCode = "400", description = "Donnees invalides ou aucune modification effective"),
            @ApiResponse(responseCode = "404", description = "Utilisateur introuvable dans l'organisation"),
            @ApiResponse(responseCode = "409", description = "Adresse email deja utilisee")
    })
    public ResponseEntity<UserListItemResponse> updateUser(
            @PathVariable Long id,
            @RequestBody UserUpdateRequest request
    ) {
        User currentUser = currentUserService.getCurrentUser();
        return ResponseEntity.ok(userService.update(
                id,
                request,
                currentUser.getOrganization().getOrganizationId()
        ));
    }
}
