package org.facturation.backend.service;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.request.SupplierCreateRequest;
import org.facturation.backend.dto.request.SupplierUpdateRequest;
import org.facturation.backend.dto.response.SupplierDetailsResponse;
import org.facturation.backend.dto.response.SupplierListItemResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.facturation.backend.dto.request.SupplierLegalIdentifierReplacementRequest;

import java.util.List;
import java.util.Optional;

public interface SupplierService {

    List<Supplier> findAll();

    Optional<Supplier> findById(Long id);

    Supplier save(Supplier supplier);

    Page<SupplierListItemResponse> findPage(String query, Pageable pageable);

    SupplierDetailsResponse findDetailsById(Long id);

    SupplierDetailsResponse create(SupplierCreateRequest request);

    SupplierDetailsResponse update(Long id, SupplierUpdateRequest request);

    Supplier findRequiredByName(Invoice invoice, String supplierName);

    Supplier findRequiredByIdForOrganization(Long supplierId, Organization organization);

    Optional<Supplier> findByLegalIdentifiers(Organization organization, String siret, String vatNumber);

    Supplier resolveForInvoiceUpload(Long supplierId, Organization organization, OcrAnalysisResponse ocrAnalysis);

    OcrSupplierResolution resolveForInvoiceUploadWithWarnings(
            Supplier selectedSupplier,
            Organization organization,
            OcrAnalysisResponse ocrAnalysis
    );

    SupplierDetailsResponse replaceLegalIdentifier(Long supplierId, Long identifierId,
                                                    SupplierLegalIdentifierReplacementRequest request);
}
