package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.CustomerCreateRequest;
import org.facturation.backend.dto.request.CustomerUpdateRequest;
import org.facturation.backend.dto.response.CustomerResponse;
import org.facturation.backend.service.CustomerService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/customers")
@Tag(name = "Clients", description = "Gestion des clients de l'organisation")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    @Operation(summary = "Lister les clients de l'organisation")
    public ResponseEntity<Page<CustomerResponse>> listCustomers(
            @Parameter(description = "Numero de page, commence a zero", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Nombre de clients par page", example = "20")
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by("name").ascending().and(Sort.by("customerId").ascending())
        );
        return ResponseEntity.ok(customerService.findPage(pageRequest));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter un client de l'organisation")
    @ApiResponse(responseCode = "404", description = "Client introuvable dans l'organisation de l'utilisateur")
    public ResponseEntity<CustomerResponse> getCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.findDetailsById(id));
    }

    @PostMapping
    @Operation(summary = "Creer un client")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Client cree"),
            @ApiResponse(responseCode = "400", description = "Donnees invalides"),
            @ApiResponse(responseCode = "409", description = "Identifiant legal deja utilise dans l'organisation")
    })
    public ResponseEntity<CustomerResponse> createCustomer(@RequestBody CustomerCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(customerService.create(request));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Modifier un client")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Client modifie"),
            @ApiResponse(responseCode = "400", description = "Donnees invalides ou aucune modification effective"),
            @ApiResponse(responseCode = "404", description = "Client introuvable dans l'organisation de l'utilisateur"),
            @ApiResponse(responseCode = "409", description = "Identifiant legal deja utilise dans l'organisation")
    })
    public ResponseEntity<CustomerResponse> updateCustomer(
            @PathVariable Long id,
            @RequestBody CustomerUpdateRequest request
    ) {
        return ResponseEntity.ok(customerService.update(id, request));
    }

    @PostMapping("/{id}/deactivate")
    @Operation(summary = "Desactiver un client sans supprimer son historique")
    public ResponseEntity<CustomerResponse> deactivateCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.deactivate(id));
    }
}
