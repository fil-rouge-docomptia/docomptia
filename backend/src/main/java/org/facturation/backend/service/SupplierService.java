package org.facturation.backend.service;

import org.facturation.backend.model.Supplier;

import java.util.List;
import java.util.Optional;

public interface SupplierService {

    List<Supplier> findAll();

    Optional<Supplier> findById(Long id);

    Supplier save(Supplier supplier);
}
