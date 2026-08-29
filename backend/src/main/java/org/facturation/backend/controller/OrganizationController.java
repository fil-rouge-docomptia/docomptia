package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.OrganizationUpdateRequest;
import org.facturation.backend.dto.response.OnboardingStatusResponse;
import org.facturation.backend.dto.response.OrganizationResponse;
import org.facturation.backend.service.OnboardingService;
import org.facturation.backend.service.OrganizationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations")
@Tag(name = "Organisations", description = "Consultation et configuration de l'organisation courante")
public class OrganizationController {

    private final OrganizationService organizationService;
    private final OnboardingService onboardingService;

    public OrganizationController(OrganizationService organizationService, OnboardingService onboardingService) {
        this.organizationService = organizationService;
        this.onboardingService = onboardingService;
    }

    @GetMapping("/current")
    @Operation(summary = "Consulter l'organisation de l'utilisateur connecte")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    public ResponseEntity<OrganizationResponse> getCurrentOrganization() {
        return ResponseEntity.ok(organizationService.findCurrentOrganization());
    }

    @PatchMapping("/current")
    @Operation(summary = "Modifier les informations legales de l'organisation courante")
    @ApiResponse(responseCode = "400", description = "Informations invalides ou aucune modification")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Droits administrateur requis")
    @ApiResponse(responseCode = "409", description = "SIRET deja utilise par une autre organisation")
    public ResponseEntity<OrganizationResponse> updateCurrentOrganization(
            @RequestBody OrganizationUpdateRequest request
    ) {
        return ResponseEntity.ok(organizationService.updateCurrentOrganization(request));
    }

    @GetMapping("/current/onboarding")
    @Operation(summary = "Consulter l'avancement de la configuration initiale")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    @ApiResponse(responseCode = "403", description = "Droits administrateur requis")
    public ResponseEntity<OnboardingStatusResponse> getCurrentOrganizationOnboardingStatus() {
        return ResponseEntity.ok(onboardingService.getCurrentOrganizationStatus());
    }
}
