package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.SupplierDetailsResponse;
import org.facturation.backend.dto.response.SupplierListItemResponse;
import org.facturation.backend.model.Supplier;
import org.springframework.stereotype.Component;

@Component
public class SupplierResponseMapper {

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
        return response;
    }

    private void applyCommonFields(SupplierListItemResponse response, Supplier supplier) {
        response.setSupplierId(supplier.getSupplierId());
        response.setName(supplier.getName());
        response.setLegalName(supplier.getLegalName());
        response.setSiret(supplier.getSiret());
        response.setVatNumber(supplier.getVatNumber());
    }
}
