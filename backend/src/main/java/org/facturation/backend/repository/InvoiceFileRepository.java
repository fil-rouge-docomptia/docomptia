package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceFile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceFileRepository extends JpaRepository<InvoiceFile, Long> {
}
