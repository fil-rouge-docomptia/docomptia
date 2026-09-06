package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.InvoiceCommentRequest;
import org.facturation.backend.dto.response.InvoiceCommentResponse;
import org.facturation.backend.service.InvoiceCommentService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/invoices/{invoiceId}/comments")
@Tag(name = "Commentaires de facture", description = "Echanges entre collaborateurs sur une facture")
public class InvoiceCommentController {

    private final InvoiceCommentService commentService;

    public InvoiceCommentController(InvoiceCommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping
    @Operation(summary = "Consulter l'historique des commentaires d'une facture")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page de commentaires retournee chronologiquement"),
            @ApiResponse(responseCode = "404", description = "Facture introuvable dans l'organisation")
    })
    public ResponseEntity<Page<InvoiceCommentResponse>> getComments(
            @PathVariable Long invoiceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return ResponseEntity.ok(commentService.getComments(invoiceId, pageRequest));
    }

    @PostMapping
    @Operation(summary = "Ajouter un commentaire sur une facture")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Commentaire enregistre"),
            @ApiResponse(responseCode = "400", description = "Commentaire vide"),
            @ApiResponse(responseCode = "404", description = "Facture introuvable dans l'organisation")
    })
    public ResponseEntity<InvoiceCommentResponse> addComment(
            @PathVariable Long invoiceId,
            @RequestBody InvoiceCommentRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(commentService.addComment(invoiceId, request));
    }
}
