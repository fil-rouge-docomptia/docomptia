package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.AccountingExportSelectionRequest;
import org.facturation.backend.dto.request.AccountingExportPreflightRequest;
import org.facturation.backend.dto.response.AccountingExportPreflightResponse;
import org.facturation.backend.dto.response.AccountingExportHistoryResponse;
import org.facturation.backend.dto.response.AccountingExportSelectionResponse;
import org.facturation.backend.dto.response.AccountingExportSummaryResponse;
import org.facturation.backend.model.ExportBatchFormat;
import org.facturation.backend.model.ExportBatchStatusCode;
import org.facturation.backend.service.AccountingExportReadService;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/accounting-exports")
@Tag(name = "Exports comptables")
public class AccountingExportReadController {
    private final AccountingExportReadService service;

    public AccountingExportReadController(AccountingExportReadService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Lister les lots de l'organisation, par date de creation decroissante")
    public Page<AccountingExportHistoryResponse> history(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) ExportBatchStatusCode status,
            @RequestParam(required = false) ExportBatchFormat format,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "8") int size) {
        return service.history(query, status, format, startDate, endDate, page, size);
    }

    @GetMapping("/summary")
    @Operation(summary = "Compter les factures eligibles, bloquees et les lots generes ce mois")
    public AccountingExportSummaryResponse summary() {
        return service.summary();
    }

    @GetMapping("/selection")
    @Operation(summary = "Controler les factures EXPORTABLE non exportees, sur une periode inclusive")
    public AccountingExportSelectionResponse selection(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return service.selection(startDate, endDate);
    }

    @PostMapping("/selection/confirm")
    @Operation(summary = "Reverifier une selection explicite sans creer de lot ni modifier les factures")
    public AccountingExportSelectionResponse confirm(@RequestBody AccountingExportSelectionRequest request) {
        return service.confirm(request);
    }

    @GetMapping("/formats")
    @Operation(summary = "Lister les formats actuellement pris en charge par les generateurs d'export")
    public List<ExportBatchFormat> formats() {
        return List.of(ExportBatchFormat.CSV, ExportBatchFormat.FEC);
    }

    @PostMapping("/preflight")
    @Operation(summary = "Controler la selection et le format sans generer de fichier ni modifier les factures")
    public AccountingExportPreflightResponse preflight(@RequestBody AccountingExportPreflightRequest request) {
        return service.preflight(request);
    }
}
