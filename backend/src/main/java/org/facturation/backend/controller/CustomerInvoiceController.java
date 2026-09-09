package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.CustomerInvoiceDraftRequest;
import org.facturation.backend.dto.response.CustomerInvoiceDraftResponse;
import org.facturation.backend.service.CustomerInvoiceDraftService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customer-invoices")
@Tag(name = "Factures clients", description = "Creation et preparation des factures clients")
public class CustomerInvoiceController {

    private final CustomerInvoiceDraftService customerInvoiceDraftService;

    public CustomerInvoiceController(CustomerInvoiceDraftService customerInvoiceDraftService) {
        this.customerInvoiceDraftService = customerInvoiceDraftService;
    }

    @PostMapping
    @Operation(summary = "Creer une facture client en brouillon")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Brouillon cree"),
            @ApiResponse(responseCode = "400", description = "Donnees du brouillon invalides"),
            @ApiResponse(responseCode = "404", description = "Client introuvable dans l'organisation courante")
    })
    public ResponseEntity<CustomerInvoiceDraftResponse> create(@RequestBody CustomerInvoiceDraftRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(customerInvoiceDraftService.create(request));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Modifier une facture client en brouillon")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Brouillon modifie"),
            @ApiResponse(responseCode = "400", description = "Donnees du brouillon invalides"),
            @ApiResponse(responseCode = "404", description = "Facture ou client introuvable dans l'organisation courante"),
            @ApiResponse(responseCode = "409", description = "La facture n'est plus un brouillon client")
    })
    public ResponseEntity<CustomerInvoiceDraftResponse> update(
            @PathVariable Long id,
            @RequestBody CustomerInvoiceDraftRequest request
    ) {
        return ResponseEntity.ok(customerInvoiceDraftService.update(id, request));
    }
}
