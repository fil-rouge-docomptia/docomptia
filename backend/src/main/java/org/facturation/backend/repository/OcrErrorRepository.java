package org.facturation.backend.repository;

import org.facturation.backend.model.OcrError;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OcrErrorRepository extends JpaRepository<OcrError, Long> {

    Optional<OcrError> findTopByInvoiceInvoiceIdOrderByOcrErrorIdDesc(Long invoiceId);
}
