package org.facturation.backend.service;

import org.facturation.backend.model.Invoice;

import java.util.List;
import java.util.Optional;

public interface InvoiceService {

    List<Invoice> findAll();

    Optional<Invoice> findById(Long id);

    Invoice save(Invoice invoice);
}
