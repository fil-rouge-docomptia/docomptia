package org.facturation.backend.service;

import org.facturation.backend.dto.request.DuplicateAlertDecisionRequest;
import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.request.InvoiceClassificationRequest;
import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceStatusResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.model.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

public interface InvoiceService {

    List<Invoice> findAll();

    Optional<Invoice> findById(Long id);

    Invoice save(Invoice invoice);

    InvoiceUploadResponse uploadAndAnalyze(MultipartFile file, Long supplierId);

    Optional<InvoiceDetailsResponse> retryOcr(Long invoiceId);

    Page<InvoiceListItemResponse> searchInvoices(
            String status,
            String supplier,
            String invoiceNumber,
            String invoiceDate,
            Pageable pageable
    );

    Optional<InvoiceDetailsResponse> findDetailsById(Long id);

    Optional<MultipartFile> downloadFile(Long id);

    Optional<InvoiceDetailsResponse> correctInvoice(Long id, InvoiceCorrectionRequest request);

    Optional<InvoiceDetailsResponse> assignClassification(Long id, InvoiceClassificationRequest request);

    Optional<InvoiceStatusResponse> submitForValidation(Long id);

    Optional<InvoiceStatusResponse> validateInvoice(Long id);

    Optional<InvoiceStatusResponse> requestInvoiceCorrection(Long id, String reason);

    Optional<InvoiceStatusResponse> rejectInvoice(Long id, String reason);

    Optional<InvoiceDetailsResponse> decideDuplicateAlert(
            Long invoiceId,
            Long alertId,
            DuplicateAlertDecisionRequest request
    );

    Optional<InvoiceAccountingEntryResponse> generateAccountingEntry(Long id);
}
