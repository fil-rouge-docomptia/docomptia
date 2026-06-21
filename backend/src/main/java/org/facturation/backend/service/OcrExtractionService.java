package org.facturation.backend.service;

import org.facturation.backend.model.OcrExtraction;

import java.util.List;
import java.util.Optional;

public interface OcrExtractionService {

    List<OcrExtraction> findAll();

    Optional<OcrExtraction> findById(Long id);

    OcrExtraction save(OcrExtraction ocrExtraction);
}
