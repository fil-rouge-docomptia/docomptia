package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.InvoiceCommentRequest;
import org.facturation.backend.dto.response.InvoiceCommentResponse;
import org.facturation.backend.service.InvoiceCommentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/invoices/{invoiceId}/comments")
@Tag(name = "Commentaires de facture", description = "Echanges entre collaborateurs sur une facture")
public class InvoiceCommentController {

    private final InvoiceCommentService commentService;

    public InvoiceCommentController(InvoiceCommentService commentService) {
        this.commentService = commentService;
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
