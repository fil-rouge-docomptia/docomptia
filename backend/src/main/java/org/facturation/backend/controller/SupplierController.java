package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.SupplierDetailsResponse;
import org.facturation.backend.dto.response.SupplierListItemResponse;
import org.facturation.backend.service.SupplierService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by("name").ascending().and(Sort.by("supplierId").ascending())
        );
        return ResponseEntity.ok(supplierService.findPage(pageRequest));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter le detail d'un fournisseur")
    @ApiResponse(responseCode = "404", description = "Fournisseur introuvable dans l'organisation de l'utilisateur")
    public ResponseEntity<SupplierDetailsResponse> getSupplier(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.findDetailsById(id));
    }
}
