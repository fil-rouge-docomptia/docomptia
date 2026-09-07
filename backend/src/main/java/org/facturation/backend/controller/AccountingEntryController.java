package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.service.AccountingEntryCorrectiveService;
import org.facturation.backend.service.AccountingEntryCorrectionService;
import org.facturation.backend.service.AccountingEntryReversalService;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.facturation.backend.dto.response.AccountingEntryReadResponse;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.service.AccountingEntryReadService;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/accounting-entries")
@Tag(name = "Ecritures comptables", description = "Consultation et correction des ecritures comptables")
public class AccountingEntryController {

    private final AccountingEntryReadService accountingEntryReadService;
    private final AccountingEntryCorrectionService accountingEntryCorrectionService;
    private final AccountingEntryReversalService accountingEntryReversalService;
    private final AccountingEntryCorrectiveService accountingEntryCorrectiveService;

    public AccountingEntryController(
            AccountingEntryReadService accountingEntryReadService,
            AccountingEntryCorrectionService accountingEntryCorrectionService,
            AccountingEntryReversalService accountingEntryReversalService,
            AccountingEntryCorrectiveService accountingEntryCorrectiveService
    ) {
        this.accountingEntryReadService = accountingEntryReadService;
        this.accountingEntryCorrectionService = accountingEntryCorrectionService;
        this.accountingEntryReversalService = accountingEntryReversalService;
        this.accountingEntryCorrectiveService = accountingEntryCorrectiveService;
    }

    @GetMapping
    @Operation(summary = "Lister les ecritures de l'organisation, de la plus recente a la plus ancienne")
    @ApiResponse(responseCode = "400", description = "Pagination ou filtre invalide")
    public ResponseEntity<Page<AccountingEntryReadResponse>> listEntries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) Boolean balanced,
            @RequestParam(required = false) AccountingEntryStatusCode status
    ) {
        if (page < 0 || size < 1 || size > 100 || query.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination or search query");
        }
        PageRequest pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "entryDate", "accountingEntryId"));
        return ResponseEntity.ok(accountingEntryReadService.findPage(query, balanced, status, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter une ecriture et ses lignes dans l'organisation courante")
    @ApiResponse(responseCode = "404", description = "Ecriture introuvable dans l'organisation")
    public ResponseEntity<AccountingEntryReadResponse> getEntry(@PathVariable Long id) {
        return ResponseEntity.ok(accountingEntryReadService.findDetails(id));
    }

    @PatchMapping("/{entryId}/lines/{lineId}")
    @Operation(
            summary = "Corriger une ligne comptable non exportee",
            description = "Modifie le compte, le libelle, le debit ou le credit et historise chaque correction"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ligne corrigee"),
            @ApiResponse(responseCode = "400", description = "Correction ou compte invalide"),
            @ApiResponse(responseCode = "404", description = "Ligne introuvable dans l'organisation"),
            @ApiResponse(responseCode = "409", description = "Ecriture non modifiable")
    })
    public ResponseEntity<AccountingEntryResponse> correctLine(
            @PathVariable Long entryId,
            @PathVariable Long lineId,
            @RequestBody AccountingEntryLineCorrectionRequest request
    ) {
        return ResponseEntity.ok(accountingEntryCorrectionService.correctLine(entryId, lineId, request));
    }

    @PostMapping("/{entryId}/reversal")
    @Operation(
            summary = "Creer l'extourne d'une ecriture exportee",
            description = "Cree une nouvelle ecriture liee a l'originale avec les debits et credits inverses"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Extourne creee"),
            @ApiResponse(responseCode = "404", description = "Ecriture introuvable dans l'organisation"),
            @ApiResponse(responseCode = "409", description = "Ecriture non exportee ou deja extournee")
    })
    public ResponseEntity<AccountingEntryResponse> createReversal(@PathVariable Long entryId) {
        return ResponseEntity.status(201).body(accountingEntryReversalService.createReversal(entryId));
    }

    @PostMapping("/{entryId}/corrective-entry")
    @Operation(
            summary = "Generer l'ecriture corrective d'une ecriture exportee",
            description = "Cree l'extourne si necessaire puis une ecriture corrective equilibree avec les montants d'origine"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Ecriture corrective creee"),
            @ApiResponse(responseCode = "404", description = "Ecriture introuvable dans l'organisation"),
            @ApiResponse(responseCode = "409", description = "Ecriture non exportee ou non corrigeable")
    })
    public ResponseEntity<AccountingEntryResponse> createCorrectiveEntry(@PathVariable Long entryId) {
        return ResponseEntity.status(201).body(accountingEntryCorrectiveService.createCorrectiveEntry(entryId));
    }
}
