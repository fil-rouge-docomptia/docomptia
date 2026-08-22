package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.ChartOfAccountCreateRequest;
import org.facturation.backend.dto.request.ChartOfAccountUpdateRequest;
import org.facturation.backend.dto.response.ChartOfAccountResponse;
import org.facturation.backend.service.ChartOfAccountService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/chart-of-accounts")
@Tag(name = "Plan comptable", description = "Gestion des comptes de l'organisation")
public class ChartOfAccountController {

    private final ChartOfAccountService chartOfAccountService;

    public ChartOfAccountController(ChartOfAccountService chartOfAccountService) {
        this.chartOfAccountService = chartOfAccountService;
    }

    @GetMapping
    @Operation(summary = "Lister les comptes de l'organisation")
    public ResponseEntity<Page<ChartOfAccountResponse>> listAccounts(
            @Parameter(description = "Numero de page, commence a zero", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Nombre de comptes par page", example = "20")
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by("accountNumber").ascending().and(Sort.by("accountId").ascending())
        );
        return ResponseEntity.ok(chartOfAccountService.findPage(pageRequest));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter un compte de l'organisation")
    @ApiResponse(responseCode = "404", description = "Compte introuvable dans l'organisation de l'utilisateur")
    public ResponseEntity<ChartOfAccountResponse> getAccount(@PathVariable Long id) {
        return ResponseEntity.ok(chartOfAccountService.findDetailsById(id));
    }

    @PostMapping
    @Operation(summary = "Creer un compte dans le plan comptable")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Compte cree"),
            @ApiResponse(responseCode = "400", description = "Donnees invalides"),
            @ApiResponse(responseCode = "409", description = "Numero de compte deja utilise dans l'organisation")
    })
    public ResponseEntity<ChartOfAccountResponse> createAccount(
            @RequestBody ChartOfAccountCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(chartOfAccountService.create(request));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Modifier un compte du plan comptable")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Compte modifie"),
            @ApiResponse(responseCode = "400", description = "Donnees invalides ou aucune modification effective"),
            @ApiResponse(responseCode = "404", description = "Compte introuvable dans l'organisation de l'utilisateur"),
            @ApiResponse(responseCode = "409", description = "Numero de compte deja utilise dans l'organisation")
    })
    public ResponseEntity<ChartOfAccountResponse> updateAccount(
            @PathVariable Long id,
            @RequestBody ChartOfAccountUpdateRequest request
    ) {
        return ResponseEntity.ok(chartOfAccountService.update(id, request));
    }

    @PostMapping("/{id}/deactivate")
    @Operation(summary = "Desactiver un compte sans supprimer son historique")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Compte desactive"),
            @ApiResponse(responseCode = "400", description = "Compte deja inactif"),
            @ApiResponse(responseCode = "404", description = "Compte introuvable dans l'organisation de l'utilisateur")
    })
    public ResponseEntity<ChartOfAccountResponse> deactivateAccount(@PathVariable Long id) {
        return ResponseEntity.ok(chartOfAccountService.deactivate(id));
    }
}
