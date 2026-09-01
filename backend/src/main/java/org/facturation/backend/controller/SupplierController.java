package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.SupplierUpdateRequest;
import org.facturation.backend.dto.request.SupplierLegalIdentifierReplacementRequest;
import org.facturation.backend.dto.response.SupplierDetailsResponse;
import org.facturation.backend.dto.response.SupplierListItemResponse;
import org.facturation.backend.service.SupplierService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/suppliers")
@Tag(name = "Fournisseurs", description = "Consultation des fournisseurs de l'organisation")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    @Operation(summary = "Lister les fournisseurs de l'organisation")
    public ResponseEntity<Page<SupplierListItemResponse>> listSuppliers(
            @Parameter(description = "Numero de page, commence a zero", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Nombre de fournisseurs par page", example = "20")
            @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Raison sociale, nom commercial ou identifiant legal")
            @RequestParam(required = false) String query
    ) {
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by("name").ascending().and(Sort.by("supplierId").ascending())
        );
        return ResponseEntity.ok(supplierService.findPage(query, pageRequest));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter le detail d'un fournisseur")
    @ApiResponse(responseCode = "404", description = "Fournisseur introuvable dans l'organisation de l'utilisateur")
    public ResponseEntity<SupplierDetailsResponse> getSupplier(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.findDetailsById(id));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Modifier les informations legales et de contact d'un fournisseur")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fournisseur modifie"),
            @ApiResponse(responseCode = "400", description = "Donnees invalides ou aucune modification effective"),
            @ApiResponse(responseCode = "404", description = "Fournisseur introuvable dans l'organisation de l'utilisateur"),
            @ApiResponse(responseCode = "409", description = "SIRET ou numero de TVA deja utilise dans l'organisation")
    })
    public ResponseEntity<SupplierDetailsResponse> updateSupplier(
            @PathVariable Long id,
            @RequestBody SupplierUpdateRequest request
    ) {
        return ResponseEntity.ok(supplierService.update(id, request));
    }

    @PatchMapping("/{supplierId}/legal-identifiers/{identifierId}")
    @Operation(summary = "Clore un identifiant legal et enregistrer son remplacement")
    public ResponseEntity<SupplierDetailsResponse> replaceLegalIdentifier(
            @PathVariable Long supplierId,
            @PathVariable Long identifierId,
            @RequestBody SupplierLegalIdentifierReplacementRequest request
    ) {
        return ResponseEntity.ok(supplierService.replaceLegalIdentifier(supplierId, identifierId, request));
    }
}
