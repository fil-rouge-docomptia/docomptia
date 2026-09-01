package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.SupplierDetailsResponse;
import org.facturation.backend.dto.response.SupplierListItemResponse;
import org.facturation.backend.model.Supplier;
import org.facturation.backend.model.SupplierLegalIdentifier;
import org.facturation.backend.repository.SupplierLegalIdentifierRepository;
import org.springframework.stereotype.Component;

@Component
public class SupplierResponseMapper {
    private final SupplierLegalIdentifierRepository identifierRepository;

    public SupplierResponseMapper(SupplierLegalIdentifierRepository identifierRepository) {
        this.identifierRepository = identifierRepository;
    }

    public SupplierListItemResponse toListItemResponse(Supplier supplier) {
        SupplierListItemResponse response = new SupplierListItemResponse();
        applyCommonFields(response, supplier);
        return response;
    }

    public SupplierDetailsResponse toDetailsResponse(Supplier supplier) {
        SupplierDetailsResponse response = new SupplierDetailsResponse();
        applyCommonFields(response, supplier);
        response.setEmail(supplier.getEmail());
        response.setPhone(supplier.getPhone());
        response.setAddress(supplier.getAddress());
        response.setCreatedAt(supplier.getCreatedAt());
        response.setUpdatedAt(supplier.getUpdatedAt());
        response.setLegalIdentifierHistory(identifierRepository
                .findBySupplierSupplierIdOrderByValidToAscCreatedAtDesc(supplier.getSupplierId()).stream()
                .map(this::toIdentifierResponse).toList());
        return response;
    }

    private void applyCommonFields(SupplierListItemResponse response, Supplier supplier) {
        response.setSupplierId(supplier.getSupplierId());
        response.setName(supplier.getName());
        response.setLegalName(supplier.getLegalName());
        response.setSiret(supplier.getSiret());
        response.setVatNumber(supplier.getVatNumber());
        response.setTradeName(supplier.getName());
        response.setCountryCode(supplier.getCountryCode());
        response.setCurrentLegalIdentifiers(identifierRepository
                .findBySupplierSupplierIdOrderByValidToAscCreatedAtDesc(supplier.getSupplierId()).stream()
                .filter(identifier -> identifier.getValidTo() == null)
                .map(this::toIdentifierResponse).toList());
    }

    private org.facturation.backend.dto.response.SupplierLegalIdentifierResponse toIdentifierResponse(
            SupplierLegalIdentifier identifier) {
        return new org.facturation.backend.dto.response.SupplierLegalIdentifierResponse(
                identifier.getSupplierLegalIdentifierId(), identifier.getType().name(), identifier.getScheme(),
                identifier.getCountryCode(), identifier.getValue(), identifier.getNormalizedValue(),
                identifier.getValidFrom(), identifier.getValidTo(), identifier.getSource().name(),
                identifier.isVerified(), identifier.getChangeReason(),
                identifier.getCreatedByUser() == null ? null : identifier.getCreatedByUser().getUserId(),
                identifier.getCreatedAt(), identifier.getUpdatedAt());
    }
}
