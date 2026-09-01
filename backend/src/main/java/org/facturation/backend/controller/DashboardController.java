package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.DashboardSummaryResponse;
import org.facturation.backend.service.DashboardService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Dashboard", description = "Synthese metier de l'organisation courante")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    @Operation(summary = "Consulter la synthese du dashboard")
    @ApiResponse(responseCode = "400", description = "Periode invalide")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    public ResponseEntity<DashboardSummaryResponse> getSummary(
            @Parameter(description = "Debut inclusif de la periode de facturation")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "Fin inclusive de la periode de facturation")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Nombre maximal de factures necessitant une action", example = "10")
            @RequestParam(defaultValue = "10") int actionLimit
    ) {
        return ResponseEntity.ok(dashboardService.getSummary(startDate, endDate, actionLimit));
    }
}
