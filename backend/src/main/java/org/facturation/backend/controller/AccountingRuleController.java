package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.AccountingRuleUpdateRequest;
import org.facturation.backend.dto.response.AccountingRuleResponse;
import org.facturation.backend.service.AccountingRuleService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/accounting-rules")
@Tag(name = "Regles comptables", description = "Configuration des comptes utilises par les regles comptables")
public class AccountingRuleController {
    private final AccountingRuleService accountingRuleService;
    public AccountingRuleController(AccountingRuleService accountingRuleService) { this.accountingRuleService = accountingRuleService; }

    @GetMapping
    @Operation(summary = "Lister les regles comptables de l'organisation")
    public ResponseEntity<List<AccountingRuleResponse>> listAccountingRules() {
        return ResponseEntity.ok(accountingRuleService.findAllForCurrentOrganization());
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Modifier les comptes d'une regle comptable")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Regle comptable modifiee"),
            @ApiResponse(responseCode = "400", description = "Compte invalide ou requete vide"),
            @ApiResponse(responseCode = "404", description = "Regle comptable introuvable dans l'organisation")
    })
    public ResponseEntity<AccountingRuleResponse> updateAccountingRule(@PathVariable Long id,
            @RequestBody AccountingRuleUpdateRequest request) {
        return ResponseEntity.ok(accountingRuleService.update(id, request));
    }
}
