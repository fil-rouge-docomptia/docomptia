package org.facturation.backend.controller;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.service.InvoiceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/invoices")
public class InvoiceController {

    private static final Set<String> ALLOWED_SEARCH_PARAMS = Set.of("status", "supplier", "invoiceDate");

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    @GetMapping
    public ResponseEntity<List<InvoiceListItemResponse>> searchInvoices(
            @RequestParam Map<String, String> params
    ) {
        if (!ALLOWED_SEARCH_PARAMS.containsAll(params.keySet())) {
            return ResponseEntity.badRequest().build();
        }

        try {
            return ResponseEntity.ok(invoiceService.searchInvoices(
                    params.get("status"),
                    params.get("supplier"),
                    params.get("invoiceDate")
            ));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<InvoiceUploadResponse> uploadInvoice(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "supplierId", required = false) Long supplierId
    ) {
        return ResponseEntity.ok(invoiceService.uploadAndAnalyze(file, supplierId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<InvoiceDetailsResponse> getInvoice(@PathVariable Long id) {
        return invoiceService.findDetailsById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<InvoiceDetailsResponse> correctInvoice(
            @PathVariable Long id,
            @RequestBody InvoiceCorrectionRequest request
    ) {
        try {
            return invoiceService.correctInvoice(id, request)
                    .map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/validate")
    public ResponseEntity<InvoiceDetailsResponse> validateInvoice(@PathVariable Long id) {
        return invoiceService.validateInvoice(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<InvoiceDetailsResponse> rejectInvoice(@PathVariable Long id) {
        return invoiceService.rejectInvoice(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
