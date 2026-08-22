package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.service.AccountingEntryCorrectionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/accounting-entries")
@Tag(name = "Ecritures comptables", description = "Consultation et correction des ecritures comptables")
public class AccountingEntryController {

    private final AccountingEntryCorrectionService accountingEntryCorrectionService;

    public AccountingEntryController(AccountingEntryCorrectionService accountingEntryCorrectionService) {
        this.accountingEntryCorrectionService = accountingEntryCorrectionService;
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
}
