package org.facturation.backend.service;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.model.Invoice;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

public interface InvoiceService {

    List<Invoice> findAll();

    Optional<Invoice> findById(Long id);

    Invoice save(Invoice invoice);

    InvoiceUploadResponse uploadAndAnalyze(MultipartFile file, Long supplierId);

    Optional<InvoiceDetailsResponse> findDetailsById(Long id);

    Optional<InvoiceDetailsResponse> correctInvoice(Long id, InvoiceCorrectionRequest request);

    Optional<InvoiceDetailsResponse> validateInvoice(Long id);

    Optional<InvoiceDetailsResponse> rejectInvoice(Long id);
}
