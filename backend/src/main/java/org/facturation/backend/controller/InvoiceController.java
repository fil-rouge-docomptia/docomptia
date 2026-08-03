package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceStatusResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.service.InvoiceService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/invoices")
@Tag(name = "Factures", description = "Depot, consultation et traitement des factures")
public class InvoiceController {

    private static final Set<String> ALLOWED_SEARCH_PARAMS = Set.of("status", "supplier", "invoiceDate");

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    @GetMapping
    @Operation(summary = "Rechercher les factures")
    @Parameters({
            @Parameter(name = "status", description = "Code du statut", example = "EXTRAITE"),
            @Parameter(name = "supplier", description = "Nom ou raison sociale du fournisseur", example = "Orange"),
            @Parameter(name = "invoiceDate", description = "Date de facture au format ISO", example = "2026-07-21")
    })
    public ResponseEntity<List<InvoiceListItemResponse>> searchInvoices(
            @Parameter(hidden = true) @RequestParam Map<String, String> params
    ) {
        if (!ALLOWED_SEARCH_PARAMS.containsAll(params.keySet())) {
            return ResponseEntity.badRequest().build();
        }

        try {
            return ResponseEntity.ok(invoiceService.searchInvoices(
                    params.get("status"),
                    params.get("supplier"),
                    params.get("invoiceDate")
            ));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Deposer et analyser une facture")
    public ResponseEntity<InvoiceUploadResponse> uploadInvoice(
            @Parameter(
                    description = "Facture PDF, PNG ou JPEG a analyser (10 Mo maximum)",
                    required = true,
                    schema = @Schema(type = "string", format = "binary")
            )
            @RequestParam("file") MultipartFile file,
            @Parameter(description = "Identifiant fournisseur optionnel", example = "1")
            @RequestParam(value = "supplierId", required = false) Long supplierId
    ) {
        return ResponseEntity.ok(invoiceService.uploadAndAnalyze(file, supplierId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter le detail d'une facture")
    public ResponseEntity<InvoiceDetailsResponse> getInvoice(@PathVariable Long id) {
        return invoiceService.findDetailsById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/accounting-entry")
    @Operation(summary = "Generer l'ecriture comptable d'une facture")
    public ResponseEntity<InvoiceAccountingEntryResponse> generateAccountingEntry(@PathVariable Long id) {
        return invoiceService.generateAccountingEntry(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Corriger manuellement une facture")
    public ResponseEntity<InvoiceDetailsResponse> correctInvoice(
            @PathVariable Long id,
            @RequestBody InvoiceCorrectionRequest request
    ) {
        try {
            return invoiceService.correctInvoice(id, request)
                    .map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/validate")
    @Operation(summary = "Valider une facture")
    public ResponseEntity<InvoiceStatusResponse> validateInvoice(@PathVariable Long id) {
        return invoiceService.validateInvoice(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Rejeter une facture")
    public ResponseEntity<InvoiceStatusResponse> rejectInvoice(@PathVariable Long id) {
        return invoiceService.rejectInvoice(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
