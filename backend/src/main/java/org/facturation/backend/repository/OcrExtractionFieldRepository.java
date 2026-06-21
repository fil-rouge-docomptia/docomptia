package org.facturation.backend.repository;

import org.facturation.backend.model.OcrExtractionField;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OcrExtractionFieldRepository extends JpaRepository<OcrExtractionField, Long> {

    List<OcrExtractionField> findByOcrExtractionOcrExtractionId(Long ocrExtractionId);
}
