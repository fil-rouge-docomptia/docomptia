package org.facturation.backend.controller;

import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.service.InvoiceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
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
