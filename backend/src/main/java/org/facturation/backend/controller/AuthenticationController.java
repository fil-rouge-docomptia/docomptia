package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.LoginRequest;
import org.facturation.backend.dto.request.RegistrationRequest;
import org.facturation.backend.dto.response.LoginResponse;
import org.facturation.backend.dto.response.RegistrationResponse;
import org.facturation.backend.service.AuthenticationService;
import org.facturation.backend.service.RegistrationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentification", description = "Connexion des utilisateurs")
public class AuthenticationController {

    private final AuthenticationService authenticationService;
    private final RegistrationService registrationService;

    public AuthenticationController(
            AuthenticationService authenticationService,
            RegistrationService registrationService
    ) {
        this.authenticationService = authenticationService;
        this.registrationService = registrationService;
    }

    @PostMapping("/login")
    @Operation(summary = "Connecter un utilisateur actif")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Identifiants valides"),
            @ApiResponse(responseCode = "401", description = "Identifiants invalides ou utilisateur inactif")
    })
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authenticationService.login(request));
    }

    @PostMapping("/register")
    @Operation(summary = "Creer une organisation et son administrateur initial")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Organisation et administrateur crees"),
            @ApiResponse(responseCode = "400", description = "Donnees d'inscription invalides"),
            @ApiResponse(responseCode = "409", description = "Email ou SIRET deja utilise")
    })
    public ResponseEntity<RegistrationResponse> register(@RequestBody RegistrationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(registrationService.register(request));
    }
}
