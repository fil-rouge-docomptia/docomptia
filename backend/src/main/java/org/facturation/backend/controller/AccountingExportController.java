package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.service.AccountingExportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/accounting-exports")
@Tag(name = "Exports comptables", description = "Generation des exports comptables")
public class AccountingExportController {

    private final AccountingExportService accountingExportService;

    public AccountingExportController(AccountingExportService accountingExportService) {
        this.accountingExportService = accountingExportService;
    }

    @PostMapping("/csv")
    @Operation(summary = "Generer et telecharger l'export CSV comptable MVP")
    @ApiResponse(responseCode = "200", description = "CSV genere")
    @ApiResponse(responseCode = "400", description = "Periode invalide ou aucune facture exportable")
    @ApiResponse(responseCode = "409", description = "Ecriture comptable desequilibree")
    public ResponseEntity<byte[]> exportCsv(
            @Parameter(description = "Debut inclusif de la periode de facturation")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "Fin inclusive de la periode de facturation")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        AccountingExportService.AccountingCsvExport export = accountingExportService.exportCsv(startDate, endDate);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(export.filename())
                        .build()
                        .toString())
                .body(export.content());
    }
}
