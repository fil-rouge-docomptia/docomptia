package org.facturation.backend.repository;

import org.facturation.backend.model.OcrExtraction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OcrExtractionRepository extends JpaRepository<OcrExtraction, Long> {

    Optional<OcrExtraction> findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(Long invoiceId);
}
