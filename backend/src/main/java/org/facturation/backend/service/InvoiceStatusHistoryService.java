package org.facturation.backend.service;

import org.facturation.backend.model.InvoiceStatusHistory;

import java.util.List;
import java.util.Optional;

public interface InvoiceStatusHistoryService {

    List<InvoiceStatusHistory> findAll();

    Optional<InvoiceStatusHistory> findById(Long id);

    InvoiceStatusHistory save(InvoiceStatusHistory invoiceStatusHistory);
}
