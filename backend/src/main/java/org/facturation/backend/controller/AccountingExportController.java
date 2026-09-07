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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    @ApiResponse(responseCode = "409", description = "Un ou plusieurs controles avant export ont echoue")
    public ResponseEntity<byte[]> exportCsv(
            @Parameter(description = "Debut inclusif de la periode de facturation")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "Fin inclusive de la periode de facturation")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        AccountingExportService.AccountingCsvExport export = accountingExportService.exportCsv(startDate, endDate);
        return accountingExportResponse(export);
    }

    @PostMapping("/fec")
    @Operation(summary = "Generer et telecharger un fichier des ecritures comptables (FEC)")
    @ApiResponse(responseCode = "200", description = "FEC genere")
    @ApiResponse(responseCode = "400", description = "Periode invalide ou aucune facture exportable")
    @ApiResponse(responseCode = "409", description = "Un ou plusieurs controles avant export ont echoue")
    public ResponseEntity<byte[]> exportFec(
            @Parameter(description = "Debut inclusif de la periode de facturation")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "Fin inclusive de la periode de facturation")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return accountingExportResponse(accountingExportService.exportFec(startDate, endDate));
    }

    @GetMapping("/{id}/file")
    @Operation(summary = "Telecharger un fichier d'export comptable")
    @ApiResponse(responseCode = "200", description = "Fichier d'export retourne")
    @ApiResponse(responseCode = "404", description = "Lot ou fichier absent dans l'organisation courante")
    public ResponseEntity<byte[]> downloadFile(@PathVariable Long id) {
        return accountingExportResponse(accountingExportService.downloadFile(id));
    }

    @PostMapping("/{id}/archive")
    @Operation(summary = "Archiver un fichier d'export comptable genere")
    @ApiResponse(responseCode = "200", description = "Fichier d'export archive")
    @ApiResponse(responseCode = "404", description = "Lot absent dans l'organisation courante")
    @ApiResponse(responseCode = "409", description = "Le lot n'est pas dans un statut archivable")
    public ResponseEntity<AccountingExportService.AccountingExportArchive> archiveFile(@PathVariable Long id) {
        return ResponseEntity.ok(accountingExportService.archiveFile(id));
    }

    private ResponseEntity<byte[]> accountingExportResponse(AccountingExportService.AccountingCsvExport export) {
        MediaType mediaType = export.filename().endsWith(".txt")
                ? new MediaType("text", "plain")
                : new MediaType("text", "csv");
        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(export.content().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(export.filename())
                        .build()
                        .toString())
                .body(export.content());
    }
}
