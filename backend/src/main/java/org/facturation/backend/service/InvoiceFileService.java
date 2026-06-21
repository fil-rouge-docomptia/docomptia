package org.facturation.backend.service;

import org.facturation.backend.model.InvoiceFile;

import java.util.List;
import java.util.Optional;

public interface InvoiceFileService {

    List<InvoiceFile> findAll();

    Optional<InvoiceFile> findById(Long id);

    InvoiceFile save(InvoiceFile invoiceFile);
}
