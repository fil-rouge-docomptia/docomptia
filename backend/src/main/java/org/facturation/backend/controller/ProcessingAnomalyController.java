package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.ProcessingAnomalyResponse;
import org.facturation.backend.service.ProcessingAnomalyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Anomalies de traitement", description = "Blocages métier rattachés aux factures")
public class ProcessingAnomalyController {

    private final ProcessingAnomalyService processingAnomalyService;

    public ProcessingAnomalyController(ProcessingAnomalyService processingAnomalyService) {
        this.processingAnomalyService = processingAnomalyService;
    }

    @GetMapping("/dashboard/anomalies")
    @Operation(summary = "Lister les anomalies de traitement de l'organisation courante")
    public ResponseEntity<List<ProcessingAnomalyResponse>> getDashboardAnomalies(
            @RequestParam(defaultValue = "false") boolean includeResolved
    ) {
        return ResponseEntity.ok(processingAnomalyService.getDashboardAnomalies(includeResolved));
    }

    @PatchMapping("/invoices/{invoiceId}/anomalies/{anomalyId}/resolve")
    @Operation(summary = "Résoudre une anomalie de traitement")
    @ApiResponse(responseCode = "404", description = "Anomalie inaccessible")
    public ResponseEntity<ProcessingAnomalyResponse> resolve(
            @PathVariable Long invoiceId,
            @PathVariable Long anomalyId
    ) {
        return ResponseEntity.ok(processingAnomalyService.resolve(invoiceId, anomalyId));
    }
}
