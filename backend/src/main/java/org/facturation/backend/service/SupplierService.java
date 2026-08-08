package org.facturation.backend.service;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.SupplierDetailsResponse;
import org.facturation.backend.dto.response.SupplierListItemResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface SupplierService {

    List<Supplier> findAll();

    Optional<Supplier> findById(Long id);

    Supplier save(Supplier supplier);

    Page<SupplierListItemResponse> findPage(Pageable pageable);

    SupplierDetailsResponse findDetailsById(Long id);

    Supplier findRequiredByName(Invoice invoice, String supplierName);

    Optional<Supplier> findByLegalIdentifiers(Organization organization, String siret, String vatNumber);

    Supplier resolveForInvoiceUpload(Long supplierId, Organization organization, OcrAnalysisResponse ocrAnalysis);
}
