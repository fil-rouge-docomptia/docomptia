package org.facturation.backend.service;

import org.facturation.backend.model.OcrExtractionField;

import java.util.List;
import java.util.Optional;

public interface OcrExtractionFieldService {

    List<OcrExtractionField> findAll();

    Optional<OcrExtractionField> findById(Long id);

    OcrExtractionField save(OcrExtractionField ocrExtractionField);
}
