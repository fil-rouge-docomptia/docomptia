package org.facturation.backend.service;

import org.facturation.backend.model.InvoiceStatus;

import java.util.List;
import java.util.Optional;

public interface InvoiceStatusService {

    List<InvoiceStatus> findAll();

    Optional<InvoiceStatus> findById(Long id);

    InvoiceStatus save(InvoiceStatus invoiceStatus);
}
