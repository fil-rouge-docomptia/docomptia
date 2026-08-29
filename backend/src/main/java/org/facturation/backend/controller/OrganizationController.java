package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.OrganizationResponse;
import org.facturation.backend.service.OrganizationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations")
@Tag(name = "Organisations", description = "Consultation de l'organisation courante")
public class OrganizationController {

    private final OrganizationService organizationService;

    public OrganizationController(OrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    @GetMapping("/current")
    @Operation(summary = "Consulter l'organisation de l'utilisateur connecte")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    public ResponseEntity<OrganizationResponse> getCurrentOrganization() {
        return ResponseEntity.ok(organizationService.findCurrentOrganization());
    }
}
