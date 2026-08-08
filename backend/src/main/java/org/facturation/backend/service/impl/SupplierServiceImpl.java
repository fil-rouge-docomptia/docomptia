package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.dto.response.SupplierDetailsResponse;
import org.facturation.backend.dto.response.SupplierListItemResponse;
import org.facturation.backend.exception.SupplierNotFoundException;
import org.facturation.backend.mapper.SupplierResponseMapper;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.SupplierRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.SupplierService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class SupplierServiceImpl implements SupplierService {

    private static final Long DEFAULT_USER_ID = 1L;

    private final SupplierRepository supplierRepository;
    private final SupplierResponseMapper supplierResponseMapper;
    private final UserRepository userRepository;

    public SupplierServiceImpl(
            SupplierRepository supplierRepository,
            SupplierResponseMapper supplierResponseMapper,
            UserRepository userRepository
    ) {
        this.supplierRepository = supplierRepository;
        this.supplierResponseMapper = supplierResponseMapper;
        this.userRepository = userRepository;
    }

    @Override
    public List<Supplier> findAll() {
        return supplierRepository.findAll();
    }

    @Override
    public Optional<Supplier> findById(Long id) {
        return supplierRepository.findById(id);
    }

    @Override
    public Supplier save(Supplier supplier) {
        return supplierRepository.save(supplier);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SupplierListItemResponse> findPage(Pageable pageable) {
        Long organizationId = findCurrentOrganizationId();
        return supplierRepository.findByOrganizationOrganizationId(organizationId, pageable)
                .map(supplierResponseMapper::toListItemResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public SupplierDetailsResponse findDetailsById(Long id) {
        Long organizationId = findCurrentOrganizationId();
        return supplierRepository.findBySupplierIdAndOrganizationOrganizationId(id, organizationId)
                .map(supplierResponseMapper::toDetailsResponse)
                .orElseThrow(() -> new SupplierNotFoundException(id));
    }

    @Override
    public Supplier findRequiredByName(Invoice invoice, String supplierName) {
        String normalizedSupplierName = requireNotBlank(supplierName, "supplierName");
        Long organizationId = invoice.getOrganization().getOrganizationId();
        return supplierRepository.findByOrganizationOrganizationIdAndNameIgnoreCase(organizationId, normalizedSupplierName)
                .or(() -> supplierRepository.findByOrganizationOrganizationIdAndLegalNameIgnoreCase(
                        organizationId,
                        normalizedSupplierName
                ))
                .orElseThrow(() -> new SupplierNotFoundException(normalizedSupplierName));
    }

    @Override
    public Optional<Supplier> findByLegalIdentifiers(Organization organization, String siret, String vatNumber) {
        Long organizationId = organization.getOrganizationId();
        Optional<Supplier> supplier = Optional.empty();

        if (!isBlank(siret)) {
            supplier = supplierRepository.findByOrganizationOrganizationIdAndSiret(organizationId, siret.trim());
        }
        if (supplier.isEmpty() && !isBlank(vatNumber)) {
            supplier = supplierRepository.findByOrganizationOrganizationIdAndVatNumberIgnoreCase(
                    organizationId,
                    vatNumber.trim()
            );
        }

        return supplier;
    }

    @Override
    public Supplier resolveForInvoiceUpload(Long supplierId, Organization organization, OcrAnalysisResponse ocrAnalysis) {
        if (supplierId != null) {
            return findById(supplierId)
                    .orElseThrow(() -> new SupplierNotFoundException(supplierId));
        }

        Optional<String> siret = extractOptionalNormalizedValue(ocrAnalysis, "siret");
        Optional<String> vatNumber = extractOptionalNormalizedValue(ocrAnalysis, "vatNumber");
        Optional<Supplier> supplierByLegalIdentifier = findByLegalIdentifiers(
                organization,
                siret.orElse(null),
                vatNumber.orElse(null)
        );
        if (supplierByLegalIdentifier.isPresent()) {
            return updateSupplierFromOcrIfNeeded(supplierByLegalIdentifier.get(), ocrAnalysis);
        }

        Optional<String> supplierName = extractOptionalNormalizedValue(ocrAnalysis, "supplierName");
        if (supplierName.isEmpty()) {
            return null;
        }

        Optional<Supplier> supplierByName = supplierRepository.findByOrganizationOrganizationIdAndNameIgnoreCase(
                        organization.getOrganizationId(),
                        supplierName.get()
                )
                .or(() -> supplierRepository.findByOrganizationOrganizationIdAndLegalNameIgnoreCase(
                        organization.getOrganizationId(),
                        supplierName.get()
                ));
        if (supplierByName.isPresent()) {
            return updateSupplierFromOcrIfNeeded(supplierByName.get(), ocrAnalysis);
        }

        if (siret.isEmpty() && vatNumber.isEmpty()) {
            return null;
        }

        return createSupplierToVerify(
                organization,
                supplierName.get(),
                siret.orElse(null),
                vatNumber.orElse(null)
        );
    }

    private Supplier createSupplierToVerify(
            Organization organization,
            String supplierName,
            String siret,
            String vatNumber
    ) {
        Supplier supplier = new Supplier();
        supplier.setOrganization(organization);
        supplier.setName(supplierName);
        supplier.setLegalName(supplierName);
        supplier.setSiret(siret);
        supplier.setVatNumber(vatNumber);
        supplier.setCreatedAt(LocalDateTime.now());
        supplier.setUpdatedAt(LocalDateTime.now());
        return supplierRepository.save(supplier);
    }

    private Supplier updateSupplierFromOcrIfNeeded(Supplier supplier, OcrAnalysisResponse ocrAnalysis) {
        boolean updated = false;

        Optional<String> siret = extractOptionalNormalizedValue(ocrAnalysis, "siret");
        if (isBlank(supplier.getSiret()) && siret.isPresent()) {
            supplier.setSiret(siret.get());
            updated = true;
        }

        Optional<String> vatNumber = extractOptionalNormalizedValue(ocrAnalysis, "vatNumber");
        if (isBlank(supplier.getVatNumber()) && vatNumber.isPresent()) {
            supplier.setVatNumber(vatNumber.get());
            updated = true;
        }

        if (!updated) {
            return supplier;
        }

        supplier.setUpdatedAt(LocalDateTime.now());
        return supplierRepository.save(supplier);
    }

    private Optional<String> extractOptionalNormalizedValue(OcrAnalysisResponse response, String fieldName) {
        return response.getFields().stream()
                .filter(field -> fieldName.equals(field.getFieldName()))
                .map(OcrFieldResponse::getNormalizedValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst();
    }

    private String requireNotBlank(String value, String fieldName) {
        if (isBlank(value)) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private Long findCurrentOrganizationId() {
        User currentUser = userRepository.findById(DEFAULT_USER_ID)
                .orElseThrow(() -> new IllegalStateException("Default user not found"));
        return currentUser.getOrganization().getOrganizationId();
    }
}
