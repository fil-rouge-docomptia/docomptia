package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.ReferenceDataResponse;
import org.facturation.backend.service.ReferenceDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reference-data")
@Tag(name = "Referentiels", description = "Consultation des referentiels utilises par le backend")
public class ReferenceDataController {

    private final ReferenceDataService referenceDataService;

    public ReferenceDataController(ReferenceDataService referenceDataService) {
        this.referenceDataService = referenceDataService;
    }

    @GetMapping
    @Operation(summary = "Lister les referentiels necessaires au frontend")
    @ApiResponse(responseCode = "401", description = "Authentification requise")
    public ResponseEntity<ReferenceDataResponse> getReferenceData() {
        return ResponseEntity.ok(referenceDataService.getReferenceData());
    }
}
