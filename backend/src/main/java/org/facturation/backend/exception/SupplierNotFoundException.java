package org.facturation.backend.exception;

public class SupplierNotFoundException extends RuntimeException {

    public SupplierNotFoundException(Long supplierId) {
        super("Supplier " + supplierId + " not found");
    }

    public SupplierNotFoundException(String supplierName) {
        super("Supplier " + supplierName + " not found");
    }
}
