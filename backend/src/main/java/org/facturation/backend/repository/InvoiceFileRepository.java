package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InvoiceFileRepository extends JpaRepository<InvoiceFile, Long> {

    Optional<InvoiceFile> findByInvoiceInvoiceId(Long invoiceId);
}
